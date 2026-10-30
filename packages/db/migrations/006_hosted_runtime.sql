-- Hosted PostgreSQL owners are not superusers. Permit the authenticated server
-- connection to SET LOCAL ROLE aar_app so RLS remains active on domain queries.
DO $$ BEGIN EXECUTE format('GRANT aar_app TO %I',current_user); END $$;
CREATE TABLE request_rate_limits (bucket text PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL CHECK(hits>0));
REVOKE ALL ON request_rate_limits FROM aar_app;
