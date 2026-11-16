-- Zayvi migration 0011: inventory locations, balances and immutable movement ledger
-- Supports own-stock inventory now and supplier/3PL locations later without
-- collapsing stock into a single product quantity field.

BEGIN;

CREATE TABLE commerce_inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  store_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  location_type text NOT NULL DEFAULT 'own_stock'
    CHECK (location_type IN ('own_stock','supplier','3pl')),
  market_code char(2) REFERENCES commerce_markets(code) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, store_id, code),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_inventory_locations_market_idx
  ON commerce_inventory_locations(tenant_id, market_code, status);

CREATE TABLE commerce_inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  tenant_catalogue_product_id uuid NOT NULL,
  on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  safety_stock integer NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, location_id, tenant_catalogue_product_id),
  FOREIGN KEY (tenant_id, location_id)
    REFERENCES commerce_inventory_locations(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, tenant_catalogue_product_id)
    REFERENCES tenant_catalogue_products(tenant_id, id) ON DELETE RESTRICT,
  CHECK (reserved <= on_hand)
);

CREATE INDEX commerce_inventory_levels_product_idx
  ON commerce_inventory_levels(tenant_id, tenant_catalogue_product_id);

CREATE TABLE commerce_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  inventory_level_id uuid NOT NULL,
  movement_type text NOT NULL
    CHECK (
      movement_type IN (
        'opening_balance',
        'receipt',
        'adjustment',
        'reservation',
        'release',
        'sale',
        'return'
      )
    ),
  quantity_delta integer NOT NULL CHECK (quantity_delta <> 0),
  reserved_delta integer NOT NULL DEFAULT 0,
  reference_type text,
  reference_id text,
  note text,
  actor text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, inventory_level_id)
    REFERENCES commerce_inventory_levels(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_inventory_movements_level_created_idx
  ON commerce_inventory_movements(tenant_id, inventory_level_id, created_at DESC);

ALTER TABLE commerce_inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_inventory_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_inventory_levels FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_inventory_movements FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_inventory_locations_isolation
  ON commerce_inventory_locations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_inventory_levels_isolation
  ON commerce_inventory_levels
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_inventory_movements_isolation
  ON commerce_inventory_movements
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_inventory_locations,
  commerce_inventory_levels
TO zayvi_app;

GRANT SELECT, INSERT ON
  commerce_inventory_movements
TO zayvi_app;

INSERT INTO commerce_inventory_locations (
  tenant_id,
  store_id,
  code,
  name,
  location_type,
  market_code
)
SELECT
  s.tenant_id,
  s.id,
  'OWN-' || m.code,
  CASE
    WHEN m.code = 'GB' THEN 'UK own stock'
    WHEN m.code = 'NG' THEN 'Nigeria own stock'
    ELSE m.code || ' own stock'
  END,
  'own_stock',
  m.code
FROM stores s
JOIN commerce_markets m
  ON m.code IN ('GB','NG')
WHERE s.slug = 'main'
  AND s.status = 'active'
ON CONFLICT (tenant_id, store_id, code) DO NOTHING;

COMMIT;
