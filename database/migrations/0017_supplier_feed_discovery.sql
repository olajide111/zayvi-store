-- Zayvi migration 0017: supplier feed ingestion and discovery candidates
-- Feed records remain review-only until explicitly approved into the catalogue.

BEGIN;

CREATE TABLE commerce_supplier_feed_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual','api','file','connector')),
  source_reference text,
  item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  rejected_count integer NOT NULL DEFAULT 0 CHECK (rejected_count >= 0),
  status text NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processed','partial','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_supplier_feed_batches_supplier_idx
  ON commerce_supplier_feed_batches(tenant_id, supplier_id, created_at DESC);

CREATE TABLE commerce_product_discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  feed_batch_id uuid NOT NULL,
  external_product_id text NOT NULL,
  supplier_sku text,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  image_url text,
  currency_code char(3) NOT NULL,
  unit_cost numeric(20,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  minimum_order_quantity integer NOT NULL DEFAULT 1 CHECK (minimum_order_quantity >= 1),
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  stock_status text NOT NULL DEFAULT 'unknown'
    CHECK (stock_status IN ('unknown','in_stock','limited','out_of_stock','preorder')),
  external_stock_quantity integer CHECK (external_stock_quantity IS NULL OR external_stock_quantity >= 0),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected')),
  review_note text,
  approved_product_id uuid REFERENCES catalogue_products(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  rejected_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(raw_payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, supplier_id, external_product_id),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, feed_batch_id)
    REFERENCES commerce_supplier_feed_batches(tenant_id, id) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code))
);

CREATE INDEX commerce_product_discovery_candidates_status_idx
  ON commerce_product_discovery_candidates(
    tenant_id,
    status,
    updated_at DESC
  );

ALTER TABLE commerce_supplier_feed_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_feed_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_product_discovery_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_product_discovery_candidates FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_supplier_feed_batches_isolation
  ON commerce_supplier_feed_batches
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_product_discovery_candidates_isolation
  ON commerce_product_discovery_candidates
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_supplier_feed_batches,
  commerce_product_discovery_candidates
TO zayvi_app;

COMMIT;
