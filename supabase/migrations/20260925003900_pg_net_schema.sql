-- pg_net landed in public; Supabase keeps extensions in the extensions
-- schema. Its functions live in the net schema either way, so the reminder
-- job is unaffected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net' AND n.nspname = 'public'
  ) THEN
    DROP EXTENSION pg_net;
    CREATE EXTENSION pg_net WITH SCHEMA extensions;
  END IF;
END
$$;
