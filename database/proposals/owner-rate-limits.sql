-- REVIEW PROPOSAL ONLY. Not in the automatic migration/bootstrap package.
-- Apply after owner-login-attempts.sql creates zayvi_owner_auth.
BEGIN;
CREATE ROLE zayvi_owner_limit_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA zayvi_owner_auth TO zayvi_owner_limit_executor;
CREATE TABLE zayvi_owner_auth.rate_limits (
 action text NOT NULL CHECK (action IN ('start','callback','status','logout')),
 key_hash text NOT NULL CHECK (key_hash='global' OR key_hash ~ '^[a-f0-9]{64}$'),
 window_start bigint NOT NULL,
 hits integer NOT NULL CHECK (hits>0),
 PRIMARY KEY(action,key_hash)
);
CREATE INDEX owner_limit_expiry ON zayvi_owner_auth.rate_limits(window_start);
REVOKE ALL ON zayvi_owner_auth.rate_limits FROM PUBLIC,zayvi_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON zayvi_owner_auth.rate_limits TO zayvi_owner_limit_executor;
CREATE FUNCTION zayvi_owner_auth.consume_limit(p_action text,p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE
 current_window bigint := floor(extract(epoch FROM clock_timestamp())/60)::bigint;
 subject_budget integer;
 global_budget integer;
 consumed integer;
BEGIN
 IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid limiter request'; END IF;
 subject_budget := CASE p_action WHEN 'start' THEN 10 WHEN 'callback' THEN 20 WHEN 'status' THEN 120 WHEN 'logout' THEN 20 ELSE NULL END;
 IF subject_budget IS NULL THEN RAISE EXCEPTION 'Invalid limiter request'; END IF;
 global_budget := subject_budget*100;
 -- Acquire the global row first on every call. The shared row serialises admission
 -- and bounds the number of new subject keys that can be stored per minute.
 INSERT INTO zayvi_owner_auth.rate_limits AS r(action,key_hash,window_start,hits)
 VALUES(p_action,'global',current_window,1)
 ON CONFLICT(action,key_hash) DO UPDATE SET
  window_start=current_window,
  hits=CASE WHEN r.window_start=current_window THEN least(r.hits+1,global_budget+1) ELSE 1 END
 RETURNING hits INTO consumed;
 IF consumed>global_budget THEN RETURN false; END IF;
 INSERT INTO zayvi_owner_auth.rate_limits AS r(action,key_hash,window_start,hits)
 VALUES(p_action,p_key,current_window,1)
 ON CONFLICT(action,key_hash) DO UPDATE SET
  window_start=current_window,
  hits=CASE WHEN r.window_start=current_window THEN least(r.hits+1,subject_budget+1) ELSE 1 END
 RETURNING hits INTO consumed;
 RETURN consumed<=subject_budget;
END
$$;
GRANT zayvi_owner_limit_executor TO CURRENT_USER WITH INHERIT TRUE, SET TRUE;
GRANT CREATE ON SCHEMA zayvi_owner_auth TO zayvi_owner_limit_executor;
ALTER FUNCTION zayvi_owner_auth.consume_limit(text,text) OWNER TO zayvi_owner_limit_executor;
REVOKE ALL ON FUNCTION zayvi_owner_auth.consume_limit(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION zayvi_owner_auth.consume_limit(text,text) TO zayvi_app;
-- Maintenance is deliberately separate from admission locks. Schedule only after
-- reviewing runtime activation. Subject hashes older than two minutes are unused.
CREATE FUNCTION zayvi_owner_auth.purge_limits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE removed integer;
BEGIN
 DELETE FROM zayvi_owner_auth.rate_limits WHERE (action,key_hash) IN (
  SELECT action,key_hash FROM zayvi_owner_auth.rate_limits
  WHERE key_hash<>'global' AND window_start<floor(extract(epoch FROM clock_timestamp())/60)::bigint-2
  ORDER BY window_start,action,key_hash LIMIT 1000 FOR UPDATE SKIP LOCKED
 );
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END
$$;
ALTER FUNCTION zayvi_owner_auth.purge_limits() OWNER TO zayvi_owner_limit_executor;
REVOKE ALL ON FUNCTION zayvi_owner_auth.purge_limits() FROM PUBLIC;
-- No application grant: a reviewed maintenance role must receive it at activation.
REVOKE CREATE ON SCHEMA zayvi_owner_auth FROM zayvi_owner_limit_executor;
REVOKE zayvi_owner_limit_executor FROM CURRENT_USER;
COMMIT;
