-- Zayvi migration 0015: supplier verification audit trail
-- Every verification state change is recorded with reviewer and note.

BEGIN;

CREATE TABLE commerce_supplier_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  from_status text NOT NULL
    CHECK (from_status IN ('unverified','pending_review','verified','rejected')),
  to_status text NOT NULL
    CHECK (to_status IN ('unverified','pending_review','verified','rejected')),
  review_note text,
  actor text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT,
  CHECK (from_status <> to_status)
);

CREATE INDEX commerce_supplier_verification_events_supplier_idx
  ON commerce_supplier_verification_events(
    tenant_id,
    supplier_id,
    created_at DESC
  );

ALTER TABLE commerce_supplier_verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_verification_events FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_supplier_verification_events_isolation
  ON commerce_supplier_verification_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON
  commerce_supplier_verification_events
TO zayvi_app;

COMMIT;
