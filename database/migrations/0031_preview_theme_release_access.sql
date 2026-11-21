BEGIN;
-- Existing tenant RLS remains in force. The API additionally requires an explicit
-- Preview-only feature flag before using these permissions.
GRANT SELECT, INSERT, UPDATE ON store_theme_releases TO zayvi_app;
GRANT SELECT, INSERT ON store_theme_release_events TO zayvi_app;
COMMIT;
