-- Zayvi migration 0007: Kredal Pay platform foundation
-- Adds Kredal as a supported provider in the payment-attempt ledger and
-- persists per-store platform connections. Payment execution remains disabled.

BEGIN;

ALTER TABLE commerce_payment_attempts
  DROP CONSTRAINT commerce_payment_attempts_provider_check;

ALTER TABLE commerce_payment_attempts
  ADD CONSTRAINT commerce_payment_attempts_provider_check
    CHECK (provider IN ('paypal','square','kredal'));

CREATE TABLE commerce_payment_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL,
  platform text NOT NULL
    CHECK (platform IN ('kredal')),
  external_connection_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','revoked')),
  approved_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, store_id, platform),
  UNIQUE (tenant_id, platform, external_connection_id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_payment_connections_status_idx
  ON commerce_payment_connections(tenant_id, platform, status);

ALTER TABLE commerce_payment_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_payment_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_payment_connections_isolation
  ON commerce_payment_connections
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON
  commerce_payment_connections
TO zayvi_app;

COMMIT;
