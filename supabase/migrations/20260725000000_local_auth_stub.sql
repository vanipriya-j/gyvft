-- Local development helpers only. Preserve hosted Supabase auth functions and roles.
CREATE SCHEMA IF NOT EXISTS auth;

DO $bootstrap$
DECLARE
  created_auth_helper boolean := false;
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    EXECUTE $definition$
      CREATE FUNCTION auth.uid()
      RETURNS UUID LANGUAGE sql STABLE
      AS $function$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $function$
    $definition$;
    created_auth_helper := true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF created_auth_helper THEN
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  END IF;
END
$bootstrap$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
