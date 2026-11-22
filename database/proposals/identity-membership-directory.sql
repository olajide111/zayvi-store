-- REVIEW PROPOSAL ONLY. Not loaded by the migration/bootstrap packager.
-- Apply only after RDS role/grant review and a separately reviewed migration.
-- Existing memberships are NOT linked automatically by email or subject.
BEGIN;
CREATE ROLE zayvi_identity_resolver NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA zayvi_identity;
REVOKE ALL ON SCHEMA zayvi_identity FROM PUBLIC;
GRANT USAGE ON SCHEMA zayvi_identity TO zayvi_identity_resolver, zayvi_app;
GRANT USAGE ON SCHEMA public TO zayvi_identity_resolver;
CREATE TABLE zayvi_identity.membership_directory (
  issuer text NOT NULL CHECK (length(issuer) BETWEEN 1 AND 2048),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 256),
  tenant_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  PRIMARY KEY (issuer, subject, tenant_id),
  UNIQUE (tenant_id, membership_id),
  FOREIGN KEY (tenant_id, membership_id) REFERENCES public.tenant_memberships(tenant_id, id) ON DELETE CASCADE
);
REVOKE ALL ON zayvi_identity.membership_directory FROM PUBLIC, zayvi_app;
GRANT SELECT ON zayvi_identity.membership_directory TO zayvi_identity_resolver;
GRANT SELECT (id, name, status) ON public.tenants TO zayvi_identity_resolver;
GRANT SELECT (id, tenant_id, role, status, mfa_required) ON public.tenant_memberships TO zayvi_identity_resolver;
-- PostgreSQL requires UPDATE privilege for row locks. No functions perform updates.
-- Never grant this NOLOGIN role to the API role or a human account.
GRANT UPDATE (membership_id) ON zayvi_identity.membership_directory TO zayvi_identity_resolver;
GRANT UPDATE (id) ON public.tenants, public.tenant_memberships TO zayvi_identity_resolver;
CREATE POLICY identity_resolver_read ON public.tenant_memberships
  FOR SELECT TO zayvi_identity_resolver USING (true);

CREATE FUNCTION zayvi_identity.resolve_memberships(p_issuer text, p_subject text)
RETURNS TABLE (tenant_id uuid, tenant_name text, tenant_status text, membership_id uuid, membership_status text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT t.id, t.name, t.status, m.id, m.status, m.role
  FROM zayvi_identity.membership_directory d
  JOIN public.tenant_memberships m ON m.tenant_id = d.tenant_id AND m.id = d.membership_id
  JOIN public.tenants t ON t.id = d.tenant_id
  WHERE d.issuer = p_issuer AND d.subject = p_subject
    AND length(p_issuer) BETWEEN 1 AND 2048 AND length(p_subject) BETWEEN 1 AND 256
  ORDER BY t.id
$$;
ALTER FUNCTION zayvi_identity.resolve_memberships(text,text) OWNER TO zayvi_identity_resolver;
REVOKE ALL ON FUNCTION zayvi_identity.resolve_memberships(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zayvi_identity.resolve_memberships(text,text) TO zayvi_app;

CREATE FUNCTION zayvi_identity.membership_is_active(
  p_issuer text, p_subject text, p_tenant uuid, p_membership uuid, p_role text, p_mfa boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
DECLARE matched boolean;
BEGIN
  IF NULLIF(current_setting('app.tenant_id', true), '') IS DISTINCT FROM p_tenant::text THEN
    RETURN false;
  END IF;
  SELECT true INTO matched
  FROM zayvi_identity.membership_directory d
  JOIN public.tenant_memberships m ON m.tenant_id = d.tenant_id AND m.id = d.membership_id
  JOIN public.tenants t ON t.id = d.tenant_id
  WHERE d.issuer = p_issuer AND d.subject = p_subject AND d.tenant_id = p_tenant
    AND m.id = p_membership AND m.role = p_role AND m.status = 'active' AND t.status = 'active'
    AND (NOT m.mfa_required OR p_mfa IS TRUE)
  FOR SHARE OF d, m, t;
  RETURN COALESCE(matched, false);
END
$$;
ALTER FUNCTION zayvi_identity.membership_is_active(text,text,uuid,uuid,text,boolean) OWNER TO zayvi_identity_resolver;
REVOKE ALL ON FUNCTION zayvi_identity.membership_is_active(text,text,uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zayvi_identity.membership_is_active(text,text,uuid,uuid,text,boolean) TO zayvi_app;
COMMIT;
