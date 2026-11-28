-- Review only. Keep execution private. The caller must verify the provider token,
-- email and MFA before passing identity claims to this function.
BEGIN;

CREATE ROLE zayvi_merchant_provisioner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA zayvi_registration;
REVOKE ALL ON SCHEMA zayvi_registration FROM PUBLIC;
GRANT USAGE ON SCHEMA zayvi_registration, zayvi_identity, public TO zayvi_merchant_provisioner;

CREATE TABLE zayvi_registration.registrations (
  issuer text NOT NULL,
  subject text NOT NULL,
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  PRIMARY KEY (issuer, subject),
  FOREIGN KEY (tenant_id, store_id) REFERENCES public.stores(tenant_id, id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED
);
GRANT SELECT, INSERT ON zayvi_registration.registrations TO zayvi_merchant_provisioner;
GRANT SELECT (issuer, subject), INSERT ON zayvi_identity.membership_directory TO zayvi_merchant_provisioner;
GRANT INSERT ON public.tenants, public.tenant_memberships, public.stores TO zayvi_merchant_provisioner;

CREATE FUNCTION zayvi_registration.create_draft_store(
  p_issuer text, p_subject text, p_email text, p_store_name text
) RETURNS TABLE (tenant_id uuid, store_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  new_tenant_id uuid := gen_random_uuid();
  new_store_id uuid := gen_random_uuid();
  new_membership_id uuid := gen_random_uuid();
  previous_tenant text := current_setting('app.tenant_id', true);
  store_name text := btrim(p_store_name);
  internal_slug text := 'store-' || new_store_id::text;
BEGIN
  IF p_issuer IS NULL OR length(p_issuer) NOT BETWEEN 1 AND 2048 OR left(p_issuer, 8) <> 'https://'
    OR p_subject IS NULL OR length(btrim(p_subject)) NOT BETWEEN 1 AND 256
    OR p_email IS NULL OR length(p_email) NOT BETWEEN 3 AND 254 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+$'
    OR store_name IS NULL OR length(store_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid merchant registration details' USING ERRCODE = '22023';
  END IF;

  INSERT INTO zayvi_registration.registrations(issuer, subject, tenant_id, store_id)
    VALUES (p_issuer, p_subject, new_tenant_id, new_store_id)
    ON CONFLICT (issuer, subject) DO NOTHING;

  IF NOT FOUND THEN
    RETURN QUERY SELECT r.tenant_id, r.store_id
      FROM zayvi_registration.registrations r
      WHERE r.issuer = p_issuer AND r.subject = p_subject;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM zayvi_identity.membership_directory d
    WHERE d.issuer = p_issuer AND d.subject = p_subject
  ) THEN
    RAISE EXCEPTION 'Merchant identity already has a membership' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.tenants(id, name, slug, status)
    VALUES (new_tenant_id, store_name, internal_slug, 'active');
  PERFORM set_config('app.tenant_id', new_tenant_id::text, true);
  INSERT INTO public.tenant_memberships(id, tenant_id, identity_subject, email, role, status, mfa_required)
    VALUES (new_membership_id, new_tenant_id, p_subject, p_email, 'owner', 'active', true);
  INSERT INTO public.stores(id, tenant_id, name, slug, status)
    VALUES (new_store_id, new_tenant_id, store_name, internal_slug, 'draft');
  INSERT INTO zayvi_identity.membership_directory(issuer, subject, tenant_id, membership_id)
    VALUES (p_issuer, p_subject, new_tenant_id, new_membership_id);
  PERFORM set_config('app.tenant_id', coalesce(previous_tenant, ''), true);

  RETURN QUERY SELECT new_tenant_id, new_store_id;
END
$$;

ALTER FUNCTION zayvi_registration.create_draft_store(text,text,text,text) OWNER TO zayvi_merchant_provisioner;
REVOKE ALL ON FUNCTION zayvi_registration.create_draft_store(text,text,text,text) FROM PUBLIC;
COMMIT;
