-- Zayvi migration 0021: supplier inventory synchronization history
-- Stores supplier-reported inventory snapshots and sync outcomes.
-- Sync can update matched supplier offers only; it never changes owned inventory or publication.

BEGIN;

CREATE TABLE commerce_supplier_inventory_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  source_type text NOT NULL
    CHECK (source_type IN ('api','portal','file','connector')),
  source_reference text,
  item_count integer NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  matched_count integer NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  unmatched_count integer NOT NULL DEFAULT 0 CHECK (unmatched_count >= 0),
  stale_count integer NOT NULL DEFAULT 0 CHECK (stale_count >= 0),
  status text NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processed','partial','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_supplier_inventory_sync_runs_supplier_idx
  ON commerce_supplier_inventory_sync_runs(
    tenant_id,
    supplier_id,
    created_at DESC
  );

CREATE TABLE commerce_supplier_inventory_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL,
  sync_run_id uuid NOT NULL,
  supplier_offer_id uuid,
  supplier_sku text,
  stock_status text NOT NULL
    CHECK (stock_status IN ('unknown','in_stock','limited','out_of_stock','preorder')),
  external_stock_quantity integer
    CHECK (external_stock_quantity IS NULL OR external_stock_quantity >= 0),
  observed_at timestamptz NOT NULL,
  outcome text NOT NULL
    CHECK (outcome IN ('applied','stale_ignored','unmatched')),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(raw_payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES commerce_suppliers(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, sync_run_id)
    REFERENCES commerce_supplier_inventory_sync_runs(tenant_id, id)
    ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supplier_offer_id)
    REFERENCES commerce_supplier_offers(tenant_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX commerce_supplier_inventory_snapshots_offer_idx
  ON commerce_supplier_inventory_snapshots(
    tenant_id,
    supplier_offer_id,
    observed_at DESC
  )
  WHERE supplier_offer_id IS NOT NULL;

CREATE INDEX commerce_supplier_inventory_snapshots_supplier_sku_idx
  ON commerce_supplier_inventory_snapshots(
    tenant_id,
    supplier_id,
    supplier_sku,
    observed_at DESC
  );

ALTER TABLE commerce_supplier_inventory_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_inventory_sync_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_supplier_inventory_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_supplier_inventory_sync_runs_isolation
  ON commerce_supplier_inventory_sync_runs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_supplier_inventory_snapshots_isolation
  ON commerce_supplier_inventory_snapshots
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_supplier_inventory_sync_runs
TO zayvi_app;

GRANT SELECT, INSERT ON
  commerce_supplier_inventory_snapshots
TO zayvi_app;

COMMIT;
