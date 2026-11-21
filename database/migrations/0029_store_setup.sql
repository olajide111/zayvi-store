BEGIN;
ALTER TABLE stores ADD COLUMN setup_profile jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(setup_profile) = 'object');
GRANT UPDATE (setup_profile) ON stores TO zayvi_app;
COMMIT;
