import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("private merchant registration creates an isolated draft and safely resumes retries", async () => {
  const db = new PGlite();
  const issuer = "https://identity.example.test";
  const register = (subject: string, name = "My Shop") => db.query<{ tenant_id: string; store_id: string }>(
    "SELECT * FROM zayvi_registration.create_draft_store($1,$2,$3,$4)",
    [issuer, subject, "merchant@example.test", name],
  );
  const apply = (path: string) => db.exec(readFileSync(path, "utf8").replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""));

  try {
    await apply("database/migrations/0001_multi_tenant_foundation.sql");
    await db.exec("CREATE ROLE zayvi_app NOLOGIN NOBYPASSRLS");
    await apply("database/proposals/identity-membership-directory.sql");
    await apply("database/proposals/merchant-registration.sql");
    await db.exec("SET ROLE zayvi_app");
    await assert.rejects(register("user-1"), /permission denied/);

    await db.exec("SET ROLE zayvi_merchant_provisioner");
    await assert.rejects(register("user-1", " "), /Invalid merchant registration/);
    await db.exec("BEGIN");
    const first = (await register("user-1")).rows[0];
    assert.equal((await db.query<{ value: string }>("SELECT coalesce(current_setting('app.tenant_id', true), '') AS value")).rows[0].value, "");
    await db.exec("COMMIT");
    assert.deepEqual((await register("user-1", "A later name")).rows, [first]);

    const second = (await register("user-2")).rows[0];
    assert.notEqual(second.tenant_id, first.tenant_id);
    assert.notEqual(second.store_id, first.store_id);

    await db.exec("RESET ROLE");
    const result = await db.query(
      `SELECT s.name, s.status, m.role, m.mfa_required, d.issuer, d.subject
       FROM public.stores s
       JOIN public.tenant_memberships m ON m.tenant_id = s.tenant_id
       JOIN zayvi_identity.membership_directory d ON d.membership_id = m.id
       WHERE s.id = $1`, [first.store_id],
    );
    assert.deepEqual(result.rows, [
      { name: "My Shop", status: "draft", role: "owner", mfa_required: true, issuer, subject: "user-1" },
    ]);
    await db.query(
      `INSERT INTO public.tenant_memberships (id, tenant_id, identity_subject, email, role, status)
       VALUES ('40000000-0000-4000-8000-000000000001', $1, 'existing-user', 'existing@example.test', 'analyst', 'active')`,
      [first.tenant_id],
    );
    await db.query(
      `INSERT INTO zayvi_identity.membership_directory VALUES ($1, 'existing-user', $2, '40000000-0000-4000-8000-000000000001')`,
      [issuer, first.tenant_id],
    );
    await db.exec("SET ROLE zayvi_merchant_provisioner");
    await assert.rejects(register("existing-user"), /already has a membership/);
    const count = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM zayvi_registration.registrations");
    assert.equal(count.rows[0].count, 2);
  } finally {
    await db.close();
  }
});
