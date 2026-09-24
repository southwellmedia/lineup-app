-- Admin essentials: shop branding, per-client stats for the client list, and
-- saving a barber's weekly hours in one transaction.

-- The shop's accent color on client-facing pages (#RRGGBB). Null uses the default.
ALTER TABLE public.shops
  ADD COLUMN brand_color text CHECK (brand_color ~ '^#[0-9a-fA-F]{6}$');

-- Visits, no-shows and spend per client. security_invoker means RLS on
-- appointments and payments applies: a barber's numbers cover only the
-- visits and payments they can see.
CREATE VIEW public.client_stats
WITH (security_invoker = true)
AS
SELECT
  c.id AS client_id,
  c.shop_id,
  count(a.id) FILTER (WHERE a.status = 'completed')::integer AS visits,
  count(a.id) FILTER (WHERE a.status = 'no_show')::integer AS no_shows,
  max(a.starts_at) FILTER (WHERE a.status = 'completed') AS last_visit_at,
  min(a.starts_at) FILTER (WHERE a.status IN ('confirmed', 'checked_in') AND a.starts_at > now()) AS next_visit_at,
  coalesce((SELECT sum(p.amount_cents) FROM public.payments p WHERE p.client_id = c.id), 0)::integer AS spent_cents
FROM public.clients c
LEFT JOIN public.appointments a ON a.client_id = c.id
GROUP BY c.id;

-- Replaces a barber's weekly hours with `p_hours`, a JSON array of
-- {weekday, start_time, end_time}. Runs as the caller, so RLS decides who
-- may do it (the barber themselves, or a manager); any failure rolls back
-- the whole change, so hours are never left half-saved.
CREATE FUNCTION public.set_working_hours(p_staff_id uuid, p_hours jsonb)
RETURNS SETOF public.working_hours
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.staff WHERE id = p_staff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'barber not found' USING ERRCODE = 'LU404';
  END IF;

  IF jsonb_typeof(p_hours) <> 'array' THEN
    RAISE EXCEPTION 'hours must be a list' USING ERRCODE = 'LU422';
  END IF;

  -- Blocks on the same day may not overlap (a break is a gap between blocks).
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT h.start_time,
             lag(h.end_time) OVER (PARTITION BY h.weekday ORDER BY h.start_time) AS prev_end
      FROM jsonb_to_recordset(p_hours) AS h(weekday smallint, start_time time, end_time time)
    ) x
    WHERE x.prev_end > x.start_time
  ) THEN
    RAISE EXCEPTION 'working hours overlap on the same day' USING ERRCODE = 'LU422';
  END IF;

  DELETE FROM public.working_hours WHERE staff_id = p_staff_id;

  RETURN QUERY
  INSERT INTO public.working_hours (shop_id, staff_id, weekday, start_time, end_time)
  SELECT v_shop, p_staff_id, h.weekday, h.start_time, h.end_time
  FROM jsonb_to_recordset(p_hours) AS h(weekday smallint, start_time time, end_time time)
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_working_hours(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_working_hours(uuid, jsonb) TO authenticated, service_role;
