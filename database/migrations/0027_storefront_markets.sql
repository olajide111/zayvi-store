BEGIN;

ALTER TABLE stores
  ADD COLUMN storefront_market_codes text[],
  ADD COLUMN storefront_market_switcher boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT stores_storefront_markets_valid CHECK (
    storefront_market_codes IS NULL OR (
      storefront_market_codes IN (ARRAY['GB'], ARRAY['NG'], ARRAY['GB','NG'])
      AND default_market_code IS NOT NULL
      AND default_market_code::text = ANY (storefront_market_codes)
    )
  );

-- Preserve the two public markets already offered by the existing Zayvi Preview store.
SELECT set_config('app.tenant_id', COALESCE((SELECT id::text FROM tenants WHERE slug = 'zayvi'), ''), true);

UPDATE stores
SET storefront_market_codes = ARRAY['GB','NG'],
    default_market_code = COALESCE(default_market_code, 'GB')
WHERE slug = 'main'
  AND tenant_id = (SELECT id FROM tenants WHERE slug = 'zayvi')
  AND (default_market_code IS NULL OR default_market_code IN ('GB', 'NG'));

GRANT UPDATE (storefront_market_codes, storefront_market_switcher, default_market_code)
  ON stores TO zayvi_app;

COMMIT;
