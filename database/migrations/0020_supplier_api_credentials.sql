-- Zayvi migration 0020: supplier API credentials
-- Adds revocable machine credentials for supplier feed submission.
-- Raw credentials are never persisted; only SHA-256 hashes and non-secret prefixes are stored.

BEGIN;

CREATE TABLE commerce_supplier_api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  label text NOT NULL,
  key_prefix text NOT NULL,
  secret_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['feed:write']::text[],
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (secret_hash),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT,
  CHECK (cardinality(scopes) >= 1)
);

CREATE INDEX commerce_supplier_api_credentials_supplier_idx
  ON commerce_supplier_api_credentials(
    tenant_id,
    supplier_id,
    status,
    created_at DESC
  );

ALTER TABLE commerce_supplier_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_api_credentials FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_supplier_api_credentials_isolation
  ON commerce_supplier_api_credentials
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_supplier_api_credentials
TO zayvi_app;

COMMIT;
