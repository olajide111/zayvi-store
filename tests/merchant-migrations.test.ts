import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { applyMerchantMigrations, merchantFiles } from "../infra/db-bootstrap/merchant-migrations";

test("merchant bootstrap applies one atomic, repeatable batch with a restricted database administrator", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE zayvi_bootstrap_test LOGIN CREATEROLE NOSUPERUSER NOBYPASSRLS;
      CREATE ROLE rds_iam NOLOGIN;
      GRANT rds_iam TO zayvi_bootstrap_test WITH ADMIN OPTION;
      GRANT CREATE ON DATABASE postgres TO zayvi_bootstrap_test;
      GRANT CREATE ON SCHEMA public TO zayvi_bootstrap_test;
      SET ROLE zayvi_bootstrap_test;
      CREATE ROLE zayvi_app LOGIN NOSUPERUSER NOBYPASSRLS;
      CREATE TABLE public.zayvi_schema_migrations (
        migration_name text PRIMARY KEY,
        checksum_sha256 text NOT NULL
      );
    `);
    await db.exec(readFileSync("database/migrations/0001_multi_tenant_foundation.sql", "utf8")
      .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""));
    const client = {
      async query(sql: string, values?: unknown[]) {
        if (values) return db.query(sql, values);
        return { rows: (await db.exec(sql)).at(-1)?.rows ?? [] };
      },
    };
    await db.exec("CREATE SCHEMA zayvi_registration");
    await assert.rejects(applyMerchantMigrations(client, "database/proposals"), /already exists/);
    assert.equal((await db.query("SELECT * FROM public.zayvi_schema_migrations")).rows.length, 0);
    assert.deepEqual((await db.query("SELECT to_regnamespace('zayvi_owner_auth') AS schema")).rows, [{ schema: null }]);
    await db.exec("DROP SCHEMA zayvi_registration");

    const expected = merchantFiles.map(file => "merchant-registration/" + file);
    assert.deepEqual(await applyMerchantMigrations(client, "database/proposals"), expected);
    assert.deepEqual(await applyMerchantMigrations(client, "database/proposals"), []);
    await db.exec("RESET ROLE; SET ROLE zayvi_merchant_registrar");
    const created = await db.query(
      "SELECT * FROM zayvi_registration.create_draft_store($1,$2,$3,$4)",
      ["https://identity.example.test", "merchant", "merchant@example.test", "Batch Shop"],
    );
    assert.equal(created.rows.length, 1);
    await assert.rejects(db.query("SELECT * FROM zayvi_registration.registrations"), /permission denied/);

    await db.exec("RESET ROLE; SET ROLE zayvi_bootstrap_test");
    await db.query("UPDATE public.zayvi_schema_migrations SET checksum_sha256='unexpected' WHERE migration_name=$1", [expected[0]]);
    await assert.rejects(applyMerchantMigrations(client, "database/proposals"), /unexpected checksums/);
  } finally {
    await db.close();
  }
});
