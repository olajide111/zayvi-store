-- Zayvi migration 0003: catalogue, suppliers and market-scoped offers
-- Depends on 0001_multi_tenant_foundation.sql and 0002_storefront_theme_versions.sql.
-- Platform reference data is separated from tenant-owned catalogue and supplier data.
-- Review and test against the selected PostgreSQL version before applying.

BEGIN;

-- Supported destination markets. This is platform reference data, not tenant data.
CREATE TABLE commerce_markets (
  code char(2) PRIMARY KEY,
  name text NOT NULL,
  currency_code char(3) NOT NULL,
  default_locale text NOT NULL,
  timezone_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  configuration_version integer NOT NULL DEFAULT 1 CHECK (configuration_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (code = upper(code)),
  CHECK (currency_code = upper(currency_code)),
  UNIQUE (code, currency_code)
);

INSERT INTO commerce_markets
  (code, name, currency_code, default_locale, timezone_name, enabled)
VALUES
  ('GB', 'United Kingdom', 'GBP', 'en-GB', 'Europe/London', false),
  ('NG', 'Nigeria', 'NGN', 'en-NG', 'Africa/Lagos', false);

-- Canonical platform product identity. It contains no market price or stock.
CREATE TABLE catalogue_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_code text UNIQUE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  brand_name text,
  product_type text,
  lifecycle_status text NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','active','retired','restricted')),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE catalogue_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES catalogue_products(id) ON DELETE RESTRICT,
  variant_code text,
  sku text,
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(option_values) = 'object'),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(attributes) = 'object'),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, id),
  UNIQUE (product_id, variant_code)
);

CREATE TABLE catalogue_product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES catalogue_products(id) ON DELETE RESTRICT,
  variant_id uuid,
  asset_key text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video','document')),
  alt_text text,
  source_name text,
  source_uri text,
  rights_status text NOT NULL DEFAULT 'unverified'
    CHECK (rights_status IN ('unverified','authorised','restricted','rejected')),
  moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected')),
  checksum_sha256 text,
  width_px integer CHECK (width_px IS NULL OR width_px > 0),
  height_px integer CHECK (height_px IS NULL OR height_px > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, variant_id)
    REFERENCES catalogue_product_variants(product_id, id) ON DELETE RESTRICT
);

CREATE INDEX catalogue_product_media_product_idx
  ON catalogue_product_media(product_id, created_at);

-- A tenant opts a canonical product into its own catalogue explicitly.
CREATE TABLE tenant_catalogue_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id uuid,
  product_id uuid NOT NULL REFERENCES catalogue_products(id) ON DELETE RESTRICT,
  merchant_sku text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','archived')),
  listing_overrides jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(listing_overrides) = 'object'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, product_id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by)
    REFERENCES tenant_memberships(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE INDEX tenant_catalogue_products_status_idx
  ON tenant_catalogue_products(tenant_id, status, updated_at DESC);

-- Supplier records and offers belong to a tenant. A supplier's status is not
-- automatically trusted by other tenants or treated as a platform endorsement.
CREATE TABLE tenant_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  legal_name text NOT NULL,
  display_name text NOT NULL,
  country_code char(2),
  website_uri text,
  contact_reference text,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected','suspended')),
  risk_status text NOT NULL DEFAULT 'unassessed'
    CHECK (risk_status IN ('unassessed','low','medium','high','blocked')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, created_by)
    REFERENCES tenant_memberships(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE INDEX tenant_suppliers_status_idx
  ON tenant_suppliers(tenant_id, verification_status, risk_status);

CREATE TABLE supplier_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tenant_catalogue_product_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  market_code char(2) NOT NULL REFERENCES commerce_markets(code) ON DELETE RESTRICT,
  supplier_sku text NOT NULL,
  source_currency char(3) NOT NULL,
  unit_cost numeric(20,6) NOT NULL CHECK (unit_cost >= 0),
  minimum_order_quantity numeric(20,6) NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0),
  availability_status text NOT NULL DEFAULT 'unknown'
    CHECK (availability_status IN ('unknown','available','limited_stock','out_of_stock','discontinued','temporarily_unavailable')),
  supplier_stock_quantity numeric(20,6) CHECK (supplier_stock_quantity IS NULL OR supplier_stock_quantity >= 0),
  fulfilment_model text NOT NULL DEFAULT 'supplier_fulfilled'
    CHECK (fulfilment_model IN ('supplier_fulfilled','tenant_collection','third_party')),
  quoted_dispatch_days integer CHECK (quoted_dispatch_days IS NULL OR quoted_dispatch_days >= 0),
  quoted_delivery_min_days integer CHECK (quoted_delivery_min_days IS NULL OR quoted_delivery_min_days >= 0),
  quoted_delivery_max_days integer CHECK (quoted_delivery_max_days IS NULL OR quoted_delivery_max_days >= quoted_delivery_min_days),
  source_reference text,
  observed_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','paused','expired','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, market_code),
  UNIQUE (tenant_id, supplier_id, market_code, supplier_sku),
  FOREIGN KEY (tenant_id, tenant_catalogue_product_id)
    REFERENCES tenant_catalogue_products(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES tenant_suppliers(tenant_id, id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR expires_at > fetched_at)
);

CREATE INDEX supplier_offers_market_product_idx
  ON supplier_offers(tenant_id, market_code, tenant_catalogue_product_id, status);
CREATE INDEX supplier_offers_supplier_idx
  ON supplier_offers(tenant_id, supplier_id, market_code, status);

-- Explicit market record for each tenant product. Absence means unknown.
CREATE TABLE tenant_product_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tenant_catalogue_product_id uuid NOT NULL,
  market_code char(2) NOT NULL REFERENCES commerce_markets(code) ON DELETE RESTRICT,
  availability_status text NOT NULL DEFAULT 'unknown'
    CHECK (availability_status IN ('unknown','available','limited_stock','out_of_stock','unavailable','restricted')),
  compliance_status text NOT NULL DEFAULT 'not_assessed'
    CHECK (compliance_status IN ('not_assessed','pending','approved','rejected','restricted')),
  publication_status text NOT NULL DEFAULT 'not_listed'
    CHECK (publication_status IN ('not_listed','pending_review','published','held','rejected','withdrawn')),
  requires_human_approval boolean NOT NULL DEFAULT true,
  customer_price numeric(20,4) CHECK (customer_price IS NULL OR customer_price >= 0),
  currency_code char(3) NOT NULL,
  price_observed_at timestamptz,
  delivery_min_days integer CHECK (delivery_min_days IS NULL OR delivery_min_days >= 0),
  delivery_max_days integer CHECK (delivery_max_days IS NULL OR delivery_max_days >= delivery_min_days),
  delivery_evidence_status text NOT NULL DEFAULT 'unknown'
    CHECK (delivery_evidence_status IN ('unknown','quoted','verified','expired','disputed')),
  assessment_score numeric(5,2) CHECK (assessment_score IS NULL OR assessment_score BETWEEN 0 AND 100),
  assessment_confidence numeric(5,2) CHECK (assessment_confidence IS NULL OR assessment_confidence BETWEEN 0 AND 100),
  assessment_version text,
  last_assessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, market_code),
  UNIQUE (tenant_id, tenant_catalogue_product_id, market_code),
  FOREIGN KEY (tenant_id, tenant_catalogue_product_id)
    REFERENCES tenant_catalogue_products(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (market_code, currency_code)
    REFERENCES commerce_markets(code, currency_code) ON DELETE RESTRICT,
  CHECK (currency_code = upper(currency_code)),
  CHECK (delivery_evidence_status <> 'verified' OR
    (delivery_min_days IS NOT NULL AND delivery_max_days IS NOT NULL))
);

CREATE INDEX tenant_product_markets_market_status_idx
  ON tenant_product_markets(tenant_id, market_code, publication_status, availability_status);

-- Evidence is append-oriented and tied to a tenant's offer or market record.
CREATE TABLE commerce_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_offer_id uuid,
  tenant_product_market_id uuid,
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'supplier_identity','supplier_stock','supplier_price','delivery_quote',
    'delivery_performance','compliance','certification','market_research',
    'fx_rate','cost_input','other'
  )),
  source_name text NOT NULL,
  source_uri text,
  private_asset_key text,
  market_code char(2) NOT NULL REFERENCES commerce_markets(code) ON DELETE RESTRICT,
  observed_at timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','verified','rejected','expired')),
  verified_by uuid,
  verification_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, supplier_offer_id, market_code)
    REFERENCES supplier_offers(tenant_id, id, market_code) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, tenant_product_market_id, market_code)
    REFERENCES tenant_product_markets(tenant_id, id, market_code) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, verified_by)
    REFERENCES tenant_memberships(tenant_id, id) ON DELETE SET NULL (verified_by),
  CHECK ((supplier_offer_id IS NOT NULL)::integer +
         (tenant_product_market_id IS NOT NULL)::integer = 1),
  CHECK (expires_at IS NULL OR expires_at > captured_at)
);

CREATE INDEX commerce_evidence_offer_idx
  ON commerce_evidence(tenant_id, supplier_offer_id, captured_at DESC);
CREATE INDEX commerce_evidence_market_idx
  ON commerce_evidence(tenant_id, tenant_product_market_id, captured_at DESC);

-- Every tenant-owned table is isolated by the server-set transaction context.
ALTER TABLE tenant_catalogue_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_catalogue_products FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_catalogue_products_isolation ON tenant_catalogue_products
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE tenant_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_suppliers_isolation ON tenant_suppliers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE supplier_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_offers FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_offers_isolation ON supplier_offers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE tenant_product_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_product_markets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_product_markets_isolation ON tenant_product_markets
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE commerce_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_evidence FORCE ROW LEVEL SECURITY;
CREATE POLICY commerce_evidence_isolation ON commerce_evidence
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMENT ON TABLE catalogue_products IS
  'Platform canonical product identity; never store market price, stock or publication state here.';
COMMENT ON TABLE tenant_catalogue_products IS
  'Tenant-owned selection and merchant-specific listing metadata for a canonical product.';
COMMENT ON TABLE supplier_offers IS
  'Tenant-owned supplier offer scoped to one destination market; missing rows mean unknown.';
COMMENT ON TABLE tenant_product_markets IS
  'Explicit tenant product-market readiness record; no record must never be interpreted as available.';
COMMENT ON TABLE commerce_evidence IS
  'Tenant-scoped source evidence with capture, observation, expiry and verification provenance.';

COMMIT;
