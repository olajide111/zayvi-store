-- Zayvi migration 0002: tenant-owned storefront theme versions and releases
-- Depends on 0001_multi_tenant_foundation.sql.
-- Apply only after the base migration has been validated on the selected PostgreSQL version.

BEGIN;

CREATE TABLE store_theme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  template_family text NOT NULL CHECK (template_family IN (
    'editorial','general-commerce','product-specification',
    'grocery','home-furniture','wholesale'
  )),
  config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, store_id, version_number),
  UNIQUE (tenant_id, store_id, id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, created_by)
    REFERENCES tenant_memberships(tenant_id, id) ON DELETE SET NULL (created_by)
);

CREATE INDEX store_theme_versions_store_created_idx
  ON store_theme_versions(tenant_id, store_id, created_at DESC);

-- A single pointer identifies the currently published immutable version.
-- Updating this pointer supports rollback without rewriting historical versions.
CREATE TABLE store_theme_releases (
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  theme_version_id uuid NOT NULL,
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, store_id),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, theme_version_id)
    REFERENCES store_theme_versions(tenant_id, store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, published_by)
    REFERENCES tenant_memberships(tenant_id, id) ON DELETE SET NULL (published_by)
);

CREATE TABLE store_theme_release_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  theme_version_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('publish','rollback')),
  actor_membership_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, store_id)
    REFERENCES stores(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, store_id, theme_version_id)
    REFERENCES store_theme_versions(tenant_id, store_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, actor_membership_id)
    REFERENCES tenant_memberships(tenant_id, id) ON DELETE SET NULL (actor_membership_id)
);

CREATE INDEX store_theme_release_events_store_created_idx
  ON store_theme_release_events(tenant_id, store_id, created_at DESC);

-- Theme version rows are immutable. New edits create a new version.
CREATE FUNCTION reject_store_theme_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Store theme versions are immutable; create a new version instead';
END;
$$;

CREATE TRIGGER store_theme_versions_immutable
  BEFORE UPDATE OR DELETE ON store_theme_versions
  FOR EACH ROW EXECUTE FUNCTION reject_store_theme_version_mutation();

-- Tenant isolation. The application must set app.tenant_id transaction-locally
-- only after server-side identity and active membership checks.
ALTER TABLE store_theme_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_theme_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY store_theme_versions_isolation ON store_theme_versions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE store_theme_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_theme_releases FORCE ROW LEVEL SECURITY;
CREATE POLICY store_theme_releases_isolation ON store_theme_releases
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE store_theme_release_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_theme_release_events FORCE ROW LEVEL SECURITY;
CREATE POLICY store_theme_release_events_isolation ON store_theme_release_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
