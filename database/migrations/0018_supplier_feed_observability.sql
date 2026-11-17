-- Zayvi migration 0018: supplier feed batch observability and replay safety
-- Stores feed checksums and durable accepted/rejected row snapshots.

BEGIN;

ALTER TABLE commerce_supplier_feed_batches
  ADD COLUMN payload_checksum text,
  ADD COLUMN accepted_details jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(accepted_details) = 'array'),
  ADD COLUMN rejection_details jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(rejection_details) = 'array');

CREATE UNIQUE INDEX commerce_supplier_feed_batches_checksum_idx
  ON commerce_supplier_feed_batches(
    tenant_id,
    supplier_id,
    payload_checksum
  )
  WHERE payload_checksum IS NOT NULL;

COMMIT;
