-- Website analytics without cookies. Each event carries a visitor hash that
-- rotates daily (computed by the server from a secret salt, IP and user
-- agent), so visitors can be counted per day but never followed across days
-- or identified. Written only by the server (service_role).

CREATE TABLE public.site_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  -- pageview / book_click: the shop website. booking_view: the booking page.
  kind text NOT NULL CHECK (kind IN ('pageview', 'book_click', 'booking_view')),
  -- Path within the shop's site ("/", "/services/fade") or the booking page.
  path text NOT NULL CHECK (length(path) BETWEEN 1 AND 300),
  -- Where the visit came from: a referring host or utm_source. Null = direct.
  referrer text CHECK (length(referrer) <= 200),
  -- booking_view only: the ?src= the booking link carried (website, instagram...).
  source text CHECK (length(source) <= 40),
  visitor text NOT NULL CHECK (length(visitor) = 32),
  device text NOT NULL CHECK (device IN ('mobile', 'desktop'))
);

CREATE INDEX site_events_shop_time_idx ON public.site_events (shop_id, occurred_at);

ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;

-- Owners and managers read their shop's numbers. No write policies: only the
-- server records events.
CREATE POLICY site_events_select ON public.site_events FOR SELECT TO authenticated
  USING (private.is_shop_manager(shop_id));

-- One shop's traffic for [p_from, p_to), grouped by local day in the shop's
-- timezone. SECURITY INVOKER, so RLS decides what the caller sees.
CREATE FUNCTION public.site_analytics(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH ev AS (
    SELECT
      e.kind,
      e.path,
      e.referrer,
      e.source,
      e.visitor,
      (e.occurred_at AT TIME ZONE s.timezone)::date AS day
    FROM public.site_events e
    JOIN public.shops s ON s.id = e.shop_id
    WHERE e.shop_id = p_shop_id AND e.occurred_at >= p_from AND e.occurred_at < p_to
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'pageviews', count(*) FILTER (WHERE kind = 'pageview'),
        'visitors', count(DISTINCT (day, visitor)) FILTER (WHERE kind = 'pageview'),
        'bookClicks', count(*) FILTER (WHERE kind = 'book_click'),
        'bookingViewsFromSite',
          count(DISTINCT (day, visitor)) FILTER (WHERE kind = 'booking_view' AND source = 'website')
      )
      FROM ev
    ),
    'daily', coalesce((
      SELECT jsonb_agg(d ORDER BY d.day)
      FROM (
        SELECT
          day,
          count(DISTINCT visitor) FILTER (WHERE kind = 'pageview') AS visitors,
          count(*) FILTER (WHERE kind = 'pageview') AS pageviews,
          count(*) FILTER (WHERE kind = 'book_click') AS "bookClicks"
        FROM ev
        GROUP BY day
      ) d
    ), '[]'::jsonb),
    'pages', coalesce((
      SELECT jsonb_agg(p)
      FROM (
        SELECT path, count(*) AS pageviews
        FROM ev WHERE kind = 'pageview'
        GROUP BY path ORDER BY count(*) DESC, path LIMIT 8
      ) p
    ), '[]'::jsonb),
    'referrers', coalesce((
      SELECT jsonb_agg(r)
      FROM (
        SELECT referrer, count(DISTINCT (day, visitor)) AS visitors
        FROM ev WHERE kind = 'pageview'
        GROUP BY referrer ORDER BY count(DISTINCT (day, visitor)) DESC LIMIT 8
      ) r
    ), '[]'::jsonb),
    'bookingSources', coalesce((
      SELECT jsonb_agg(b)
      FROM (
        SELECT source, count(DISTINCT (day, visitor)) AS visitors
        FROM ev WHERE kind = 'booking_view'
        GROUP BY source ORDER BY count(DISTINCT (day, visitor)) DESC LIMIT 8
      ) b
    ), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.site_analytics(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_analytics(uuid, timestamptz, timestamptz)
  TO authenticated, service_role;
