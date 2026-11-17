-- Zayvi migration 0019: vendor portal access
-- Adds invite-only supplier-user access. Vendor permissions remain supplier-scoped.

BEGIN;

CREATE TABLE commerce_supplier_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner','editor','viewer')),
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','revoked')),
  invite_token_hash text,
  invite_expires_at timestamptz,
  activated_at timestamptz,
  last_login_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supplier_id, email),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_supplier_users_supplier_idx
  ON commerce_supplier_users(tenant_id, supplier_id, status);

CREATE UNIQUE INDEX commerce_supplier_users_invite_hash_idx
  ON commerce_supplier_users(invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

ALTER TABLE commerce_supplier_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_users FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_supplier_users_isolation
  ON commerce_supplier_users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_supplier_users
TO zayvi_app;

COMMIT;
