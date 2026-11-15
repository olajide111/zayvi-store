-- Zayvi migration 0005: customers and order persistence
-- Adds tenant-scoped customer, order and immutable order-line snapshots.
-- Payment processing remains separate from order creation.

BEGIN;

CREATE TABLE commerce_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','blocked','archived')),
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, store_id, email),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_customers_tenant_updated_idx
  ON commerce_customers(tenant_id, updated_at DESC);

CREATE TABLE commerce_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL,
  customer_id uuid,
  order_number text NOT NULL UNIQUE,
  market_code char(2) NOT NULL REFERENCES commerce_markets(code) ON DELETE RESTRICT,
  currency_code char(3) NOT NULL,
  order_status text NOT NULL DEFAULT 'draft'
    CHECK (order_status IN ('draft','pending_payment','confirmed','cancelled','completed')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','paid','failed','partially_refunded','refunded')),
  fulfilment_status text NOT NULL DEFAULT 'unfulfilled'
    CHECK (fulfilment_status IN ('unfulfilled','processing','fulfilled','cancelled')),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  subtotal numeric(20,4) NOT NULL CHECK (subtotal >= 0),
  shipping_total numeric(20,4) NOT NULL DEFAULT 0 CHECK (shipping_total >= 0),
  tax_total numeric(20,4) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total numeric(20,4) NOT NULL CHECK (total >= 0),
  source text NOT NULL DEFAULT 'storefront'
    CHECK (source IN ('storefront','admin','import','api','preview')),
  placed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, customer_id)
    REFERENCES commerce_customers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (market_code, currency_code)
    REFERENCES commerce_markets(code, currency_code) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code)),
  CHECK (total = subtotal + shipping_total + tax_total)
);

CREATE INDEX commerce_orders_tenant_created_idx
  ON commerce_orders(tenant_id, created_at DESC);
CREATE INDEX commerce_orders_customer_idx
  ON commerce_orders(tenant_id, customer_id, created_at DESC);
CREATE INDEX commerce_orders_status_idx
  ON commerce_orders(tenant_id, order_status, payment_status, fulfilment_status);

CREATE TABLE commerce_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL,
  tenant_catalogue_product_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES catalogue_products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  merchant_sku text,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  unit_price numeric(20,4) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(20,4) NOT NULL CHECK (line_total >= 0),
  currency_code char(3) NOT NULL,
  selected_options jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(selected_options) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, tenant_catalogue_product_id)
    REFERENCES tenant_catalogue_products(tenant_id, id) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code)),
  CHECK (line_total = unit_price * quantity)
);

CREATE INDEX commerce_order_items_order_idx
  ON commerce_order_items(tenant_id, order_id, created_at);

ALTER TABLE commerce_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_customers FORCE ROW LEVEL SECURITY;
CREATE POLICY commerce_customers_isolation ON commerce_customers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE commerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY commerce_orders_isolation ON commerce_orders
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE commerce_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY commerce_order_items_isolation ON commerce_order_items
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_customers,
  commerce_orders,
  commerce_order_items
TO zayvi_app;

COMMIT;
