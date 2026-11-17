-- Zayvi migration 0024: central operations audit ledger
-- Append-only tenant-scoped audit evidence for critical commerce operations.
-- Application role may insert/read but cannot update or delete historical events.

BEGIN;

CREATE TABLE commerce_operations_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_type text NOT NULL
    CHECK (actor_type IN ('admin','vendor','system')),
  actor_reference text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  market_code char(2),
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE INDEX commerce_operations_audit_events_created_idx
  ON commerce_operations_audit_events(
    tenant_id,
    created_at DESC
  );

CREATE INDEX commerce_operations_audit_events_entity_idx
  ON commerce_operations_audit_events(
    tenant_id,
    entity_type,
    entity_id,
    created_at DESC
  );

CREATE INDEX commerce_operations_audit_events_action_idx
  ON commerce_operations_audit_events(
    tenant_id,
    action,
    created_at DESC
  );

ALTER TABLE commerce_operations_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_operations_audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_operations_audit_events_isolation
  ON commerce_operations_audit_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON
  commerce_operations_audit_events
TO zayvi_app;

COMMIT;
