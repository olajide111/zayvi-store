-- REVIEW PROPOSAL ONLY: depends on both identity-directory and login-attempt proposals.
-- Not packaged as a migration and not applied automatically.
BEGIN;
CREATE ROLE zayvi_owner_session_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public,zayvi_identity,zayvi_owner_auth TO zayvi_owner_session_executor;
CREATE TABLE zayvi_owner_auth.owner_sessions (
  session_hash text PRIMARY KEY CHECK(session_hash ~ '^[a-f0-9]{64}$'),
  tenant_id uuid NOT NULL,
  store_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  issuer text NOT NULL CHECK(length(issuer) BETWEEN 1 AND 2048),
  subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 256),
  role text NOT NULL,
  authentication_time bigint NOT NULL CHECK(authentication_time>0),
  provider_session_id text NOT NULL CHECK(length(provider_session_id) BETWEEN 1 AND 512),
  provider_token_id text NOT NULL CHECK(length(provider_token_id) BETWEEN 1 AND 512),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY(tenant_id,store_id) REFERENCES public.stores(tenant_id,id),
  FOREIGN KEY(tenant_id,membership_id) REFERENCES public.tenant_memberships(tenant_id,id),
  CHECK(expires_at>created_at AND expires_at<=created_at+interval '1 hour')
);
CREATE INDEX owner_sessions_expiry ON zayvi_owner_auth.owner_sessions(expires_at);
REVOKE ALL ON zayvi_owner_auth.owner_sessions FROM PUBLIC,zayvi_app;
GRANT SELECT,INSERT,DELETE ON zayvi_owner_auth.owner_sessions TO zayvi_owner_session_executor;
GRANT UPDATE(revoked_at) ON zayvi_owner_auth.owner_sessions TO zayvi_owner_session_executor;
GRANT SELECT(id,tenant_id,status),UPDATE(id) ON public.stores TO zayvi_owner_session_executor;
GRANT EXECUTE ON FUNCTION zayvi_identity.membership_is_active(text,text,uuid,uuid,text,boolean) TO zayvi_owner_session_executor;

CREATE FUNCTION zayvi_owner_auth.create_session(p_hash text,p_tenant uuid,p_store uuid,p_member uuid,p_issuer text,p_subject text,p_role text,p_auth bigint,p_provider_session text,p_provider_token text,p_expiry timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF NULLIF(current_setting('app.tenant_id',true),'') IS DISTINCT FROM p_tenant::text
    OR p_auth<=0 OR p_auth>extract(epoch FROM clock_timestamp())+5
    OR NOT zayvi_identity.membership_is_active(p_issuer,p_subject,p_tenant,p_member,p_role,true) THEN
    RAISE EXCEPTION 'Authorised owner session context required';
  END IF;
  PERFORM id FROM public.stores WHERE tenant_id=p_tenant AND id=p_store AND status IN ('draft','active') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store is unavailable'; END IF;
  DELETE FROM zayvi_owner_auth.owner_sessions WHERE session_hash IN (SELECT session_hash FROM zayvi_owner_auth.owner_sessions WHERE expires_at<=clock_timestamp() LIMIT 100);
  INSERT INTO zayvi_owner_auth.owner_sessions(session_hash,tenant_id,store_id,membership_id,issuer,subject,role,authentication_time,provider_session_id,provider_token_id,expires_at)
    VALUES(p_hash,p_tenant,p_store,p_member,p_issuer,p_subject,p_role,p_auth,p_provider_session,p_provider_token,p_expiry);
END $$;
CREATE FUNCTION zayvi_owner_auth.resolve_session(p_hash text)
RETURNS TABLE(tenant_id uuid,store_id uuid,membership_id uuid,issuer text,subject text,role text,authentication_time bigint,provider_session_id text,provider_token_id text,expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT s.tenant_id,s.store_id,s.membership_id,s.issuer,s.subject,s.role,s.authentication_time,s.provider_session_id,s.provider_token_id,s.expires_at
  FROM zayvi_owner_auth.owner_sessions s WHERE s.session_hash=p_hash AND s.revoked_at IS NULL AND s.expires_at>statement_timestamp()
$$;
CREATE FUNCTION zayvi_owner_auth.session_is_active(p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE matched boolean;
BEGIN
  SELECT true INTO matched FROM zayvi_owner_auth.owner_sessions s
    WHERE s.session_hash=p_hash AND s.tenant_id::text=NULLIF(current_setting('app.tenant_id',true),'')
      AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() FOR SHARE;
  RETURN COALESCE(matched,false);
END $$;
CREATE FUNCTION zayvi_owner_auth.revoke_session(p_hash text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  UPDATE zayvi_owner_auth.owner_sessions SET revoked_at=clock_timestamp() WHERE session_hash=p_hash AND revoked_at IS NULL
$$;
ALTER FUNCTION zayvi_owner_auth.create_session(text,uuid,uuid,uuid,text,text,text,bigint,text,text,timestamptz) OWNER TO zayvi_owner_session_executor;
ALTER FUNCTION zayvi_owner_auth.resolve_session(text) OWNER TO zayvi_owner_session_executor;
ALTER FUNCTION zayvi_owner_auth.session_is_active(text) OWNER TO zayvi_owner_session_executor;
ALTER FUNCTION zayvi_owner_auth.revoke_session(text) OWNER TO zayvi_owner_session_executor;
REVOKE ALL ON FUNCTION zayvi_owner_auth.create_session(text,uuid,uuid,uuid,text,text,text,bigint,text,text,timestamptz),zayvi_owner_auth.resolve_session(text),zayvi_owner_auth.session_is_active(text),zayvi_owner_auth.revoke_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zayvi_owner_auth.create_session(text,uuid,uuid,uuid,text,text,text,bigint,text,text,timestamptz),zayvi_owner_auth.resolve_session(text),zayvi_owner_auth.session_is_active(text),zayvi_owner_auth.revoke_session(text) TO zayvi_app;
COMMIT;
