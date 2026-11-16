-- Zayvi migration 0010: exact Kredal event reconciliation
-- Adds sequence/order metadata from Kredal's documented webhook envelope so
-- signed events can be applied in order and duplicate/older deliveries ignored.

BEGIN;

ALTER TABLE commerce_payment_events
  ADD COLUMN IF NOT EXISTS provider_sequence bigint,
  ADD COLUMN IF NOT EXISTS schema_version text,
  ADD COLUMN IF NOT EXISTS livemode boolean,
  ADD COLUMN IF NOT EXISTS business_id text,
  ADD COLUMN IF NOT EXISTS provider_object_id text,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS provider_connection_id text;

ALTER TABLE commerce_payment_events
  ADD CONSTRAINT commerce_payment_events_sequence_positive
    CHECK (provider_sequence IS NULL OR provider_sequence >= 0);

CREATE INDEX IF NOT EXISTS commerce_payment_events_reference_sequence_idx
  ON commerce_payment_events(
    tenant_id,
    platform,
    provider_reference,
    provider_sequence DESC
  )
  WHERE provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS commerce_payment_events_connection_sequence_idx
  ON commerce_payment_events(
    tenant_id,
    platform,
    provider_connection_id,
    provider_sequence DESC
  )
  WHERE provider_connection_id IS NOT NULL;

COMMIT;
