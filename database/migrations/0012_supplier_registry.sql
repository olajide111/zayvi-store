-- Zayvi migration 0012: supplier registry and supplier product offers
-- Adds tenant-scoped supplier identity, verification and commercial offer records.
-- Supplier verification remains a controlled admin action; no automatic trust is inferred.

BEGIN;

CREATE TABLE commerce_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL,
  supplier_code text NOT NULL,
  name text NOT NULL,
  supplier_type text NOT NULL
    CHECK (supplier_type IN ('dropship','wholesale','manufacturer','3pl')),
  market_code char(2) REFERENCES commerce_markets(code) ON DELETE RESTRICT,
  fulfilment_model text NOT NULL DEFAULT 'supplier_fulfilled'
    CHECK (fulfilment_model IN ('supplier_fulfilled','zayvi_fulfilled','3pl_fulfilled')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','archived')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending_review','verified','rejected')),
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, store_id, supplier_code),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_suppliers_market_status_idx
  ON commerce_suppliers(tenant_id, market_code, status);

CREATE INDEX commerce_suppliers_verification_idx
  ON commerce_suppliers(tenant_id, verification_status, updated_at DESC);

CREATE TABLE commerce_supplier_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  tenant_catalogue_product_id uuid NOT NULL,
  supplier_sku text,
  currency_code char(3) NOT NULL,
  unit_cost numeric(20,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  minimum_order_quantity integer NOT NULL DEFAULT 1 CHECK (minimum_order_quantity >= 1),
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  stock_status text NOT NULL DEFAULT 'unknown'
    CHECK (stock_status IN ('unknown','in_stock','limited','out_of_stock','preorder')),
  external_stock_quantity integer CHECK (external_stock_quantity IS NULL OR external_stock_quantity >= 0),
  source_updated_at timestamptz,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supplier_id, tenant_catalogue_product_id),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, tenant_catalogue_product_id)
    REFERENCES tenant_catalogue_products(tenant_id, id) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code))
);

CREATE INDEX commerce_supplier_offers_product_idx
  ON commerce_supplier_offers(tenant_id, tenant_catalogue_product_id, status);

ALTER TABLE commerce_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_suppliers FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_offers FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_suppliers_isolation
  ON commerce_suppliers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_supplier_offers_isolation
  ON commerce_supplier_offers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_suppliers,
  commerce_supplier_offers
TO zayvi_app;

COMMIT;
