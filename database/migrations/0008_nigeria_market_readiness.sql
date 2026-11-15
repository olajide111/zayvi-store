-- Zayvi migration 0008: Nigeria market readiness records
-- Creates explicit NG market rows for the existing Zayvi catalogue without
-- inventing or converting prices. Admin review must set NGN pricing and
-- availability before Nigeria checkout can use a product.

BEGIN;

INSERT INTO tenant_product_markets (
  tenant_id,
  tenant_catalogue_product_id,
  market_code,
  availability_status,
  compliance_status,
  publication_status,
  requires_human_approval,
  customer_price,
  currency_code,
  price_observed_at
)
SELECT
  tcp.tenant_id,
  tcp.id,
  'NG',
  'unknown',
  'not_assessed',
  'not_listed',
  true,
  NULL,
  'NGN',
  NULL
FROM tenant_catalogue_products tcp
JOIN tenants t
  ON t.id = tcp.tenant_id
WHERE t.slug = 'zayvi'
ON CONFLICT (tenant_id, tenant_catalogue_product_id, market_code)
DO NOTHING;

COMMIT;
