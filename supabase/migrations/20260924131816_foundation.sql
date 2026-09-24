-- Foundation: extensions and shared helpers used by every later migration.

-- btree_gist lets an exclusion constraint combine "same staff member" (=)
-- with "overlapping time range" (&&). This is what makes double-booking
-- impossible at the database level.
-- Installed into the `extensions` schema, as Supabase recommends, to keep
-- its objects out of the API-exposed public schema.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Keeps updated_at honest on every table that has one.
CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Validates an IANA timezone name (e.g. 'America/Chicago').
CREATE FUNCTION public.is_valid_timezone(tz text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = tz);
$$;
