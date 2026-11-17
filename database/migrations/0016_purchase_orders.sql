-- Zayvi migration 0016: purchase orders and supplier replenishment planning
-- Purchase orders remain human-created and human-approved. No supplier submission is automatic.

BEGIN;

CREATE TABLE commerce_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  market_code char(2) NOT NULL REFERENCES commerce_markets(code) ON DELETE RESTRICT,
  currency_code char(3) NOT NULL,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','submitted','partially_received','received','cancelled')),
  notes text,
  approved_by text,
  approved_at timestamptz,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, po_number),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code))
);

CREATE INDEX commerce_purchase_orders_status_idx
  ON commerce_purchase_orders(tenant_id, status, updated_at DESC);

CREATE TABLE commerce_purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  purchase_order_id uuid NOT NULL,
  supplier_offer_id uuid NOT NULL,
  tenant_catalogue_product_id uuid NOT NULL,
  supplier_sku text,
  quantity integer NOT NULL CHECK (quantity >= 1),
  unit_cost numeric(20,4) NOT NULL CHECK (unit_cost >= 0),
  currency_code char(3) NOT NULL,
  received_quantity integer NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, purchase_order_id, supplier_offer_id),
  FOREIGN KEY (tenant_id, purchase_order_id)
    REFERENCES commerce_purchase_orders(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supplier_offer_id)
    REFERENCES commerce_supplier_offers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, tenant_catalogue_product_id)
    REFERENCES tenant_catalogue_products(tenant_id, id) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code)),
  CHECK (received_quantity <= quantity)
);

CREATE INDEX commerce_purchase_order_items_po_idx
  ON commerce_purchase_order_items(tenant_id, purchase_order_id);

ALTER TABLE commerce_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_purchase_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_purchase_order_items FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_purchase_orders_isolation
  ON commerce_purchase_orders
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_purchase_order_items_isolation
  ON commerce_purchase_order_items
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_purchase_orders,
  commerce_purchase_order_items
TO zayvi_app;

COMMIT;
