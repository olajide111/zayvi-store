BEGIN;
-- Rows remain immutable and protected by tenant RLS from migration 0002.
-- No release pointer or release-event write permissions are added.
GRANT SELECT, INSERT ON store_theme_versions TO zayvi_app;
COMMIT;
