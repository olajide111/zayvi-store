-- Zayvi migration 0014: controlled fulfilment execution
-- Adds explicit dispatch and delivery state to allocations.
-- Owned stock is consumed only on manual dispatch confirmation.

BEGIN;

ALTER TABLE commerce_fulfilment_allocations
  ADD COLUMN execution_status text NOT NULL DEFAULT 'pending'
    CHECK (execution_status IN ('pending','dispatched','delivered','cancelled')),
  ADD COLUMN carrier text,
  ADD COLUMN tracking_number text,
  ADD COLUMN dispatched_at timestamptz,
  ADD COLUMN delivered_at timestamptz;

CREATE INDEX commerce_fulfilment_allocations_execution_idx
  ON commerce_fulfilment_allocations(
    tenant_id,
    fulfilment_plan_id,
    execution_status
  );

COMMIT;
