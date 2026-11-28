-- Review only. Requires RDS IAM authentication and merchant-registration.sql.
BEGIN;
CREATE ROLE zayvi_merchant_registrar LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT rds_iam TO zayvi_merchant_registrar;
GRANT USAGE ON SCHEMA zayvi_registration TO zayvi_merchant_registrar;
GRANT EXECUTE ON FUNCTION zayvi_registration.create_draft_store(text,text,text,text) TO zayvi_merchant_registrar;
COMMIT;
