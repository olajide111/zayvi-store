BEGIN;

CREATE TABLE commerce_storefront_content (
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  market_code char(2) NOT NULL REFERENCES commerce_markets(code),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  kind text NOT NULL CHECK (kind IN ('page', 'article')),
  draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
  published jsonb CHECK (published IS NULL OR jsonb_typeof(published) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  draft_changed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (tenant_id, store_id, market_code, slug),
  FOREIGN KEY (tenant_id, store_id) REFERENCES stores(tenant_id, id),
  CHECK ((published IS NULL) = (published_at IS NULL))
);

ALTER TABLE commerce_storefront_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_storefront_content FORCE ROW LEVEL SECURITY;

CREATE POLICY commerce_storefront_content_isolation ON commerce_storefront_content
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON commerce_storefront_content TO zayvi_app;

COMMIT;
