-- Foundation: extensions and shared helpers used by every later migration.

-- btree_gist lets an exclusion constraint combine "same staff member" (=)
-- with "overlapping time range" (&&). This is what makes double-booking
-- impossible at the database level.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Keeps updated_at honest on every table that has one.
CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
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
AS $$
  SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = tz);
$$;
