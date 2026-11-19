BEGIN;

ALTER TABLE stores
  ADD COLUMN storefront_social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT stores_storefront_social_links_object
    CHECK (jsonb_typeof(storefront_social_links) = 'object');

GRANT UPDATE (storefront_social_links) ON stores TO zayvi_app;

COMMIT;
