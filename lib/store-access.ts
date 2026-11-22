import {
  withAuthorisedTenant,
  type TenantAccessDependencies,
  type TenantRequestContext,
} from './tenant-access';

export type StoreRecord = {
  id: string;
  tenantId: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
};
export type StoreRequestContext = TenantRequestContext & {store: StoreRecord};
export interface StoreDirectory {
  /** Parameterised lookup by both IDs, inside the current tenant transaction. */
  findStore(tenantId: string, storeId: string): Promise<StoreRecord | null>;
}
export class StoreAccessError extends Error {
  constructor(public readonly code: 'STORE_BINDING_REQUIRED' | 'STORE_ACCESS_DENIED', message: string) {
    super(message);
    this.name = 'StoreAccessError';
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Store-scoped extension of the verified tenant pipeline. boundStoreId comes
 * from trusted server configuration, never a submitted store name or slug.
 * Missing binding fails closed: no fallback to the legacy main store.
 * Adapters must be wired before this constitutes a live selling integration.
 */
export async function withAuthorisedStore<Token, Result>(input: {
  token: Token | null | undefined;
  selectedTenantId?: string | null;
  boundStoreId: string | null | undefined;
  requestedStoreId?: string | null;
  requiredPermission: string;
  dependencies: Omit<TenantAccessDependencies<Token, Result>, 'execute'> & {
    stores: StoreDirectory;
    execute(context: StoreRequestContext): Promise<Result>;
  };
}): Promise<Result> {
  const storeId = input.boundStoreId;
  if (!storeId || !uuid.test(storeId)) {
    throw new StoreAccessError('STORE_BINDING_REQUIRED', 'A trusted store binding is required.');
  }
  if (input.requestedStoreId != null && input.requestedStoreId.toLowerCase() !== storeId.toLowerCase()) {
    throw new StoreAccessError('STORE_ACCESS_DENIED', 'The requested store is not available.');
  }
  return withAuthorisedTenant({
    token: input.token,
    selectedTenantId: input.selectedTenantId,
    requiredPermission: input.requiredPermission,
    dependencies: {
      ...input.dependencies,
      async execute(context) {
        const store = await input.dependencies.stores.findStore(context.tenantId, storeId);
        if (!store || store.id.toLowerCase() !== storeId.toLowerCase() || store.tenantId !== context.tenantId || !['draft', 'active'].includes(store.status)) {
          throw new StoreAccessError('STORE_ACCESS_DENIED', 'The requested store is not available.');
        }
        return input.dependencies.execute({...context, store: {...store}});
      },
    },
  });
}
