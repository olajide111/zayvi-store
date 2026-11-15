-- Zayvi migration 0009: Kredal webhook event ledger
-- Persists signed provider events idempotently. Event payload shape is stored
-- verbatim; money-state transitions are applied only after verified provider
-- lookup, never from guessed webhook fields.

BEGIN;

ALTER TABLE commerce_payment_attempts
  DROP CONSTRAINT commerce_payment_attempts_status_check;

ALTER TABLE commerce_payment_attempts
  ADD CONSTRAINT commerce_payment_attempts_status_check
    CHECK (
      status IN (
        'created',
        'pending',
        'authorised',
        'held',
        'captured',
        'failed',
        'cancelled',
        'partially_refunded',
        'refunded'
      )
    );

CREATE TABLE commerce_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  platform text NOT NULL CHECK (platform IN ('kredal','square','paypal')),
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payment_attempt_id uuid,
  connection_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'stored'
    CHECK (processing_status IN ('stored','verified','applied','ignored','failed')),
  processing_note text,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, platform, external_event_id),
  FOREIGN KEY (tenant_id, payment_attempt_id)
    REFERENCES commerce_payment_attempts(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, connection_id)
    REFERENCES commerce_payment_connections(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_payment_events_received_idx
  ON commerce_payment_events(tenant_id, platform, received_at DESC);

CREATE INDEX commerce_payment_events_unprocessed_idx
  ON commerce_payment_events(tenant_id, platform, processing_status, received_at)
  WHERE processing_status IN ('stored','failed');

ALTER TABLE commerce_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_payment_events FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_payment_events_isolation
  ON commerce_payment_events
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON
  commerce_payment_events
TO zayvi_app;

COMMIT;
