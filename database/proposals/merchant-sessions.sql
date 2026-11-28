-- Review only. Requires the owner session and merchant registration proposals.
BEGIN;

GRANT USAGE ON SCHEMA zayvi_registration TO zayvi_owner_session_executor, zayvi_app;
GRANT SELECT (issuer, subject, tenant_id, store_id) ON zayvi_registration.registrations TO zayvi_owner_session_executor;
GRANT SELECT (issuer, subject, tenant_id, membership_id) ON zayvi_identity.membership_directory TO zayvi_owner_session_executor;

CREATE FUNCTION zayvi_registration.resolve_session(p_hash text, p_issuer text)
RETURNS TABLE(tenant_id uuid,store_id uuid,membership_id uuid,issuer text,subject text,role text,authentication_time bigint,provider_session_id text,provider_token_id text,expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT s.tenant_id,s.store_id,s.membership_id,s.issuer,s.subject,s.role,s.authentication_time,s.provider_session_id,s.provider_token_id,s.expires_at
  FROM zayvi_owner_auth.owner_sessions s
  JOIN zayvi_registration.registrations r
    USING (issuer,subject,tenant_id,store_id)
  JOIN zayvi_identity.membership_directory d
    ON (d.issuer,d.subject,d.tenant_id,d.membership_id)=(s.issuer,s.subject,s.tenant_id,s.membership_id)
  WHERE s.session_hash=p_hash AND s.issuer=p_issuer AND s.role='owner'
    AND s.revoked_at IS NULL AND s.expires_at>statement_timestamp()
$$;

CREATE FUNCTION zayvi_registration.revoke_session(p_hash text, p_issuer text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  UPDATE zayvi_owner_auth.owner_sessions s SET revoked_at=clock_timestamp()
  FROM zayvi_registration.registrations r
  JOIN zayvi_identity.membership_directory d USING (issuer,subject,tenant_id)
  WHERE (s.issuer,s.subject,s.tenant_id,s.store_id,s.membership_id)=(r.issuer,r.subject,r.tenant_id,r.store_id,d.membership_id)
    AND s.session_hash=p_hash AND s.issuer=p_issuer AND s.role='owner' AND s.revoked_at IS NULL
$$;

ALTER FUNCTION zayvi_registration.resolve_session(text,text) OWNER TO zayvi_owner_session_executor;
ALTER FUNCTION zayvi_registration.revoke_session(text,text) OWNER TO zayvi_owner_session_executor;
REVOKE ALL ON FUNCTION zayvi_registration.resolve_session(text,text),zayvi_registration.revoke_session(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zayvi_registration.resolve_session(text,text),zayvi_registration.revoke_session(text,text) TO zayvi_app;
COMMIT;
