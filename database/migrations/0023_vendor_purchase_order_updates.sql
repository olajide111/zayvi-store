-- Zayvi migration 0023: supplier purchase-order acknowledgements and shipment evidence
-- Supplier updates are informational evidence only. They do not approve, cancel,
-- receive or otherwise alter the Admin-controlled purchase-order lifecycle.

BEGIN;

ALTER TABLE commerce_purchase_orders
  ADD COLUMN supplier_ack_status text NOT NULL DEFAULT 'pending'
    CHECK (supplier_ack_status IN ('pending','acknowledged','unable_to_fulfil')),
  ADD COLUMN supplier_acknowledged_at timestamptz,
  ADD COLUMN supplier_reference text,
  ADD COLUMN supplier_update_note text,
  ADD COLUMN latest_carrier text,
  ADD COLUMN latest_tracking_number text,
  ADD COLUMN latest_shipped_at timestamptz,
  ADD COLUMN expected_delivery_at timestamptz;

CREATE TABLE commerce_purchase_order_supplier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  purchase_order_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  supplier_user_id uuid,
  event_type text NOT NULL
    CHECK (event_type IN ('acknowledged','unable_to_fulfil','shipment_update')),
  supplier_reference text,
  note text,
  carrier text,
  tracking_number text,
  shipped_at timestamptz,
  expected_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES commerce_purchase_orders(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supplier_user_id)
    REFERENCES commerce_supplier_users(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_purchase_order_supplier_events_po_idx
  ON commerce_purchase_order_supplier_events(
    tenant_id,
    purchase_order_id,
    created_at DESC
  );

ALTER TABLE commerce_purchase_order_supplier_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_purchase_order_supplier_events FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_purchase_order_supplier_events_isolation
  ON commerce_purchase_order_supplier_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON
  commerce_purchase_order_supplier_events
TO zayvi_app;

COMMIT;
