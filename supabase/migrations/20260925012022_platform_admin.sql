-- Lineup's own back office: who runs the platform, what they changed, and
-- the per-shop switches they control.

-- People who run Lineup itself (not a shop). Read only by the server.
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  note text CHECK (length(note) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- No policies: signed-in users can't read or write it.

-- Every change an admin makes. Append-only, and without foreign keys so it
-- outlives deleted logins and shops (like payments.recorded_by).
CREATE TABLE public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action ~ '^[a-z_]+(\.[a-z_]+)*$' AND length(action) <= 60),
  shop_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_shop_idx ON public.admin_audit_log (shop_id, created_at DESC);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'the admin audit log is append-only' USING ERRCODE = 'LU422';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_audit_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- A suspended shop keeps its data and dashboard, but its booking page,
-- website and texts stop.
ALTER TABLE public.shops
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN suspended_reason text CHECK (length(suspended_reason) <= 500),
  -- May publish premium website templates. Set by Lineup, not the shop.
  ADD COLUMN premium_templates boolean NOT NULL DEFAULT false;

-- Shops already on a premium template keep it.
UPDATE public.shops SET premium_templates = true WHERE site_template = 'contact-sheet';

-- Shop staff can't change their own plan, premium access or suspension;
-- only the server (service role) can.
CREATE FUNCTION public.guard_platform_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.premium_templates IS DISTINCT FROM OLD.premium_templates
          OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
          OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
          OR NEW.plan IS DISTINCT FROM OLD.plan) THEN
    RAISE EXCEPTION 'only Lineup can change a shop''s plan, premium templates or suspension'
      USING ERRCODE = 'LU422';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_platform_columns() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER shops_guard_platform_columns
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_columns();

-- Per-shop activity since a point in time, for the admin panel.
CREATE FUNCTION public.admin_shop_stats(p_since timestamptz)
RETURNS TABLE (
  shop_id uuid,
  staff integer,
  clients integer,
  bookings integer,
  booked_cents bigint,
  last_booking_at timestamptz,
  texts_sent integer,
  texts_failed integer,
  site_views integer
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    s.id,
    (SELECT count(*) FROM public.staff st WHERE st.shop_id = s.id AND st.is_active)::integer,
    (SELECT count(*) FROM public.clients c WHERE c.shop_id = s.id)::integer,
    (SELECT count(*) FROM public.appointments a
      WHERE a.shop_id = s.id AND a.created_at >= p_since
        AND a.status IN ('confirmed', 'checked_in', 'completed', 'no_show'))::integer,
    (SELECT coalesce(sum(a.total_price_cents), 0) FROM public.appointments a
      WHERE a.shop_id = s.id AND a.created_at >= p_since
        AND a.status IN ('confirmed', 'checked_in', 'completed'))::bigint,
    (SELECT max(a.created_at) FROM public.appointments a
      WHERE a.shop_id = s.id AND a.status NOT IN ('held', 'expired')),
    (SELECT count(*) FROM public.messages m
      WHERE m.shop_id = s.id AND m.created_at >= p_since
        AND m.direction = 'outbound' AND m.status = 'sent')::integer,
    (SELECT count(*) FROM public.messages m
      WHERE m.shop_id = s.id AND m.created_at >= p_since AND m.status = 'failed')::integer,
    (SELECT count(*) FROM public.site_events e
      WHERE e.shop_id = s.id AND e.occurred_at >= p_since AND e.kind = 'pageview')::integer
  FROM public.shops s;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_shop_stats(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_shop_stats(timestamptz) TO service_role;

-- Bookings across every shop by where the client came from.
CREATE FUNCTION public.admin_booking_sources(p_since timestamptz)
RETURNS TABLE (source public.booking_source, bookings integer)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT a.source, count(*)::integer
  FROM public.appointments a
  WHERE a.created_at >= p_since AND a.status IN ('confirmed', 'checked_in', 'completed', 'no_show')
  GROUP BY a.source
  ORDER BY 2 DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_booking_sources(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_booking_sources(timestamptz) TO service_role;
