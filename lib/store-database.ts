import {AsyncLocalStorage} from 'node:async_hooks';
import type {StoreDirectory, StoreRecord} from './store-access';
import type {TenantTransactionRunner} from './tenant-access';

/** Structural interfaces accept a node-postgres pool without adding it to browser dependencies. */
export interface StoreDatabaseClient {
  query(sql: string, values?: unknown[]): Promise<{rows: Record<string, unknown>[]} >;
  release(error?: Error): void;
}
export interface StoreDatabasePool {connect(): Promise<StoreDatabaseClient>}
type Scope = {tenantId: string; client: StoreDatabaseClient; active: boolean};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Request-local adapters for the authorised store pipeline. No global pool,
 * connection URL, environment fallback, or legacy main-store selection.
 */
export function createStoreDatabaseAdapters(pool: StoreDatabasePool) {
  const scope = new AsyncLocalStorage<Scope>();
  function current(tenantId: string) {
    const value = scope.getStore();
    if (!value?.active || value.tenantId !== tenantId) {
      throw new Error('An active matching tenant transaction is required.');
    }
    return value.client;
  }
  const transactions: TenantTransactionRunner = {
    async withTenantTransaction<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
      if (!uuid.test(tenantId)) throw new Error('A valid tenant identity is required.');
      if (scope.getStore()) throw new Error('Nested tenant transactions are not supported.');
      const client = await pool.connect();
      let started = false;
      let discard: Error | undefined;
      const context: Scope = {tenantId, client, active: false};
      try {
        await client.query('BEGIN');
        started = true;
        const role = (await client.query(`SELECT rolsuper, rolbypassrls,
          current_setting('row_security') AS row_security
          FROM pg_catalog.pg_roles WHERE rolname = current_user`)).rows[0];
        if (!role || role.rolsuper !== false || role.rolbypassrls !== false || role.row_security !== 'on') {
          throw new Error('A database role subject to row security is required.');
        }
        const tables = (await client.query(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
          FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname IN ('tenant_memberships', 'stores')`)).rows;
        if (tables.length !== 2 || tables.some(table => table.relrowsecurity !== true || table.relforcerowsecurity !== true)) {
          throw new Error('Tenant tables must enforce row security.');
        }
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        context.active = true;
        let result: T;
        try {result = await scope.run(context, work);} finally {context.active = false;}
        await client.query('COMMIT');
        return result;
      } catch (error) {
        context.active = false;
        if (started) {
          try {await client.query('ROLLBACK');}
          catch {discard = new Error('Discard connection after failed transaction cleanup.');}
        } else {
          discard = new Error('Discard connection after transaction startup failed.');
        }
        throw error;
      } finally {
        context.active = false;
        client.release(discard);
      }
    },
  };
  const stores: StoreDirectory = {
    async findStore(tenantId, storeId) {
      const client = current(tenantId);
      if (!uuid.test(storeId)) throw new Error('A valid store identity is required.');
      const rows = (await client.query(`SELECT id, tenant_id, status FROM public.stores
        WHERE tenant_id = $1::uuid AND id = $2::uuid FOR SHARE`, [tenantId, storeId])).rows;
      if (rows.length !== 1) return null;
      const row = rows[0];
      if (typeof row.id !== 'string' || typeof row.tenant_id !== 'string' ||
          !['draft', 'active', 'paused', 'archived'].includes(String(row.status))) {
        throw new Error('Invalid store record.');
      }
      return {id: row.id, tenantId: row.tenant_id, status: row.status} as StoreRecord;
    },
  };
  return {
    transactions,
    stores,
    /** All protected database work must use this same transaction client and be awaited. */
    async withTenantClient<T>(tenantId: string, work: (client: StoreDatabaseClient) => Promise<T>): Promise<T> {
      return work(current(tenantId));
    },
  };
}
