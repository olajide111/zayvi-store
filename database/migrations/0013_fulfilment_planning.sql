-- Zayvi migration 0013: fulfilment planning and stock reservations
-- Adds auditable, human-approved fulfilment plans and allocation records.
-- Reservations change reserved stock without reducing on-hand inventory.

BEGIN;

ALTER TABLE commerce_inventory_movements
  DROP CONSTRAINT commerce_inventory_movements_quantity_delta_check;

ALTER TABLE commerce_inventory_movements
  ADD CONSTRAINT commerce_inventory_movements_nonzero_change_check
  CHECK (quantity_delta <> 0 OR reserved_delta <> 0);

CREATE TABLE commerce_fulfilment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','cancelled','completed')),
  recommendation_version text NOT NULL DEFAULT 'v1',
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(rationale) = 'object'),
  approved_by text,
  approved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, order_id),
  FOREIGN KEY (tenant_id, order_id)
    REFERENCES commerce_orders(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX commerce_fulfilment_plans_status_idx
  ON commerce_fulfilment_plans(tenant_id, status, updated_at DESC);

CREATE TABLE commerce_fulfilment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  fulfilment_plan_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  source_type text NOT NULL
    CHECK (source_type IN ('own_stock','supplier')),
  inventory_level_id uuid,
  supplier_offer_id uuid,
  quantity integer NOT NULL CHECK (quantity >= 1),
  unit_cost_snapshot numeric(20,4)
    CHECK (unit_cost_snapshot IS NULL OR unit_cost_snapshot >= 0),
  currency_code char(3) NOT NULL,
  expected_lead_time_days integer
    CHECK (expected_lead_time_days IS NULL OR expected_lead_time_days >= 0),
  score_snapshot numeric(8,2),
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(rationale) = 'object'),
  reservation_status text NOT NULL DEFAULT 'not_reserved'
    CHECK (reservation_status IN ('not_reserved','reserved','released','consumed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, fulfilment_plan_id, order_item_id),
  FOREIGN KEY (tenant_id, fulfilment_plan_id)
    REFERENCES commerce_fulfilment_plans(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, order_item_id)
    REFERENCES commerce_order_items(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, inventory_level_id)
    REFERENCES commerce_inventory_levels(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, supplier_offer_id)
    REFERENCES commerce_supplier_offers(tenant_id, id) ON DELETE RESTRICT,
  CHECK (
    (source_type = 'own_stock' AND inventory_level_id IS NOT NULL AND supplier_offer_id IS NULL)
    OR
    (source_type = 'supplier' AND supplier_offer_id IS NOT NULL AND inventory_level_id IS NULL)
  ),
  CHECK (currency_code = upper(currency_code))
);

CREATE INDEX commerce_fulfilment_allocations_plan_idx
  ON commerce_fulfilment_allocations(tenant_id, fulfilment_plan_id);

CREATE INDEX commerce_fulfilment_allocations_inventory_idx
  ON commerce_fulfilment_allocations(tenant_id, inventory_level_id)
  WHERE inventory_level_id IS NOT NULL;

ALTER TABLE commerce_fulfilment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_fulfilment_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE commerce_fulfilment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_fulfilment_allocations FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_fulfilment_plans_isolation
  ON commerce_fulfilment_plans
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY commerce_fulfilment_allocations_isolation
  ON commerce_fulfilment_allocations
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON
  commerce_fulfilment_plans,
  commerce_fulfilment_allocations
TO zayvi_app;

COMMIT;
