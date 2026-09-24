-- When a client actually sat down and when the cut finished. Set by the
-- database on status changes, so every path (dashboard, app, agents)
-- records them. Powers the live "in the chair" timer and, later, real
-- service-time reporting.

ALTER TABLE public.appointments
  ADD COLUMN checked_in_at timestamptz,
  ADD COLUMN completed_at timestamptz;

CREATE FUNCTION public.stamp_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'checked_in' AND OLD.status IS DISTINCT FROM 'checked_in' THEN
    NEW.checked_in_at := now();
  END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := now();
    -- Marked paid without a check-in: treat the chair time as starting at the booking.
    NEW.checked_in_at := coalesce(NEW.checked_in_at, least(NEW.starts_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.stamp_appointment_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER appointments_stamp_status
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_appointment_status();
