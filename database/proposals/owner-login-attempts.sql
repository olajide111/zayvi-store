-- REVIEW PROPOSAL ONLY. Not part of the automatic migration/bootstrap package.
BEGIN;
CREATE ROLE zayvi_owner_login_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA zayvi_owner_auth;
REVOKE ALL ON SCHEMA zayvi_owner_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA zayvi_owner_auth TO zayvi_owner_login_executor, zayvi_app;
CREATE TABLE zayvi_owner_auth.login_attempts (
  state_hash text PRIMARY KEY CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  browser_hash text NOT NULL CHECK (browser_hash ~ '^[a-f0-9]{64}$'),
  encrypted_payload text NOT NULL CHECK (length(encrypted_payload) BETWEEN 1 AND 16384),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes')
);
CREATE INDEX login_attempt_expiry ON zayvi_owner_auth.login_attempts(expires_at);
REVOKE ALL ON zayvi_owner_auth.login_attempts FROM PUBLIC,zayvi_app;
GRANT SELECT,INSERT,DELETE ON zayvi_owner_auth.login_attempts TO zayvi_owner_login_executor;
CREATE FUNCTION zayvi_owner_auth.create_attempt(p_state text,p_browser text,p_payload text,p_expiry timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  DELETE FROM zayvi_owner_auth.login_attempts WHERE state_hash IN (
    SELECT state_hash FROM zayvi_owner_auth.login_attempts WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100
  );
  INSERT INTO zayvi_owner_auth.login_attempts(state_hash,browser_hash,encrypted_payload,expires_at)
  VALUES(p_state,p_browser,p_payload,p_expiry);
END
$$;
GRANT zayvi_owner_login_executor TO CURRENT_USER WITH INHERIT TRUE, SET TRUE;
GRANT CREATE ON SCHEMA zayvi_owner_auth TO zayvi_owner_login_executor;
ALTER FUNCTION zayvi_owner_auth.create_attempt(text,text,text,timestamptz) OWNER TO zayvi_owner_login_executor;
REVOKE ALL ON FUNCTION zayvi_owner_auth.create_attempt(text,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zayvi_owner_auth.create_attempt(text,text,text,timestamptz) TO zayvi_app;
CREATE FUNCTION zayvi_owner_auth.consume_attempt(p_state text,p_browser text)
RETURNS TABLE(encrypted_payload text) LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  DELETE FROM zayvi_owner_auth.login_attempts a
  WHERE a.state_hash=p_state AND a.browser_hash=p_browser AND a.expires_at>clock_timestamp()
  RETURNING a.encrypted_payload
$$;
ALTER FUNCTION zayvi_owner_auth.consume_attempt(text,text) OWNER TO zayvi_owner_login_executor;
REVOKE ALL ON FUNCTION zayvi_owner_auth.consume_attempt(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zayvi_owner_auth.consume_attempt(text,text) TO zayvi_app;
REVOKE CREATE ON SCHEMA zayvi_owner_auth FROM zayvi_owner_login_executor;
REVOKE zayvi_owner_login_executor FROM CURRENT_USER;
COMMIT;
