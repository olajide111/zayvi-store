-- Zayvi migration 0001: multi-tenant platform foundation
-- PostgreSQL 15+ recommended. Apply only to a dedicated Zayvi database.
-- This migration is a reviewed starting point; validate with the selected migration runner before deployment.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legal_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','closed')),
  default_market_code char(2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  identity_subject text NOT NULL,
  email text NOT NULL,
  display_name text,
  role text NOT NULL CHECK (role IN (
    'owner','administrator','store_manager','catalog_manager',
    'supplier_manager','fulfilment','finance','support','analyst','read_only'
  )),
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','suspended','removed')),
  mfa_required boolean NOT NULL DEFAULT true,
  invited_by uuid REFERENCES tenant_memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, identity_subject),
  UNIQUE (tenant_id, id)
);

CREATE INDEX tenant_memberships_subject_idx
  ON tenant_memberships(identity_subject, status);
CREATE INDEX tenant_memberships_tenant_role_idx
  ON tenant_memberships(tenant_id, role, status);

CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','archived')),
  brand_name text,
  logo_asset_key text,
  theme_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_locale text NOT NULL DEFAULT 'en-GB',
  default_market_code char(2),
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  UNIQUE (tenant_id, id)
);

CREATE INDEX stores_tenant_status_idx ON stores(tenant_id, status);

CREATE TABLE store_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  hostname text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verifying','verified','disabled')),
  verification_token_hash text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX store_domains_tenant_store_idx ON store_domains(tenant_id, store_id);

CREATE TABLE platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES platform_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial','active','past_due','paused','cancelled','expired')),
  billing_provider text,
  provider_customer_ref text,
  provider_subscription_ref text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id)
);

CREATE INDEX tenant_subscriptions_tenant_status_idx
  ON tenant_subscriptions(tenant_id, status);

CREATE TABLE plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES platform_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  limit_value bigint,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (plan_id, feature_key)
);

CREATE TABLE tenant_entitlement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  feature_key text NOT NULL,
  enabled boolean,
  limit_value bigint,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  expires_at timestamptz,
  created_by uuid REFERENCES tenant_memberships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, feature_key)
);

CREATE TABLE tenant_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_membership_id uuid REFERENCES tenant_memberships(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tenant_audit_events_tenant_created_idx
  ON tenant_audit_events(tenant_id, created_at DESC);
CREATE INDEX tenant_audit_events_entity_idx
  ON tenant_audit_events(tenant_id, entity_type, entity_id);

-- Tenant isolation: application must set app.tenant_id inside each transaction
-- only after authenticating the user and resolving active membership server-side.
-- Never accept this setting directly from a browser request.
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_memberships_isolation ON tenant_memberships
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
CREATE POLICY stores_isolation ON stores
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE store_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_domains FORCE ROW LEVEL SECURITY;
CREATE POLICY store_domains_isolation ON store_domains
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_subscriptions_isolation ON tenant_subscriptions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE tenant_entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_entitlement_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_entitlement_overrides_isolation ON tenant_entitlement_overrides
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE tenant_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_audit_events_isolation ON tenant_audit_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
