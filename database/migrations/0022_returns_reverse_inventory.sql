-- Zayvi migration 0022: returns, refund intent and reverse inventory
-- Returns are admin-reviewed. Provider payment status remains provider-controlled.
-- Stock can only re-enter owned inventory after explicit receipt/inspection.

BEGIN;

CREATE TABLE commerce_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL,
  return_number text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','rejected','received','completed','cancelled')),
  reason text NOT NULL,
  review_note text,
  inspection_note text,
  refund_status text NOT NULL DEFAULT 'not_requested'
    CHECK (refund_status IN ('not_requested','pending_provider','partially_refunded','refunded')),
  requested_refund_amount numeric(20,4) NOT NULL DEFAULT 0
    CHECK (requested_refund_amount >= 0),
  currency_code char(3) NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  received_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, return_number),
  FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders(tenant_id, id) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code))
);

CREATE INDEX commerce_returns_order_idx
  ON commerce_returns(tenant_id, order_id, created_at DESC);

CREATE INDEX commerce_returns_status_idx
  ON commerce_returns(tenant_id, status, updated_at DESC);

CREATE TABLE commerce_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  return_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  tenant_catalogue_product_id uuid NOT NULL,
  quantity_requested integer NOT NULL CHECK (quantity_requested >= 1),
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_restocked integer NOT NULL DEFAULT 0 CHECK (quantity_restocked >= 0),
  condition text NOT NULL DEFAULT 'pending_inspection'
    CHECK (condition IN ('pending_inspection','new','opened','damaged','faulty')),
  restock_decision text NOT NULL DEFAULT 'pending'
    CHECK (restock_decision IN ('pending','restock','do_not_restock')),
  refund_amount numeric(20,4) NOT NULL CHECK (refund_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, return_id, order_item_id),
  FOREIGN KEY (tenant_id, return_id)
    REFERENCES commerce_returns(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, order_item_id)
    REFERENCES commerce_order_items(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, tenant_catalogue_product_id)
    REFERENCES tenant_catalogue_products(tenant_id, id) ON DELETE RESTRICT,
  CHECK (quantity_received <= quantity_requested),
  CHECK (quantity_restocked <= quantity_received)
);

CREATE INDEX commerce_return_items_return_idx
  ON commerce_return_items(tenant_id, return_id);

ALTER TABLE commerce_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_returns FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_return_items FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_returns_isolation
  ON commerce_returns
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_return_items_isolation
  ON commerce_return_items
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_returns,
  commerce_return_items
TO zayvi_app;

COMMIT;
