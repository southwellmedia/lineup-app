-- Clients and appointments. The exclusion constraint on appointments is the
-- single guarantee against double-booking, no matter which channel (web,
-- chat agent, voice agent, barber app) writes the booking.

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  -- E.164, e.g. +12145550123. Clients are unique per shop by phone.
  phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  email text,
  notes text,
  preferred_staff_id uuid,
  -- Consent is recorded as the moment it was given; null means no consent.
  sms_consent_at timestamptz,
  email_consent_at timestamptz,
  marketing_consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, phone),
  UNIQUE (shop_id, id),
  FOREIGN KEY (shop_id, preferred_staff_id) REFERENCES public.staff (shop_id, id)
    ON DELETE SET NULL (preferred_staff_id)
);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.appointment_status AS ENUM (
  'held',        -- slot reserved while the client finishes checkout (e.g. pays a deposit)
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
  'expired'      -- a hold that timed out
);

-- Where the client came from. Powers the "no commission on your clients"
-- promise, so it must be recorded on every booking.
CREATE TYPE public.booking_source AS ENUM (
  'booking_link',
  'website',
  'instagram',
  'google',
  'phone',
  'walk_in',
  'referral',
  'import',
  'other'
);

-- Who (or what) created the booking, independent of where the client came from.
CREATE TYPE public.booking_actor AS ENUM ('client', 'staff', 'chat_agent', 'voice_agent', 'import');

CREATE TYPE public.cancellation_party AS ENUM ('client', 'shop');

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL,
  client_id uuid,
  status public.appointment_status NOT NULL,
  starts_at timestamptz NOT NULL,
  -- End of the service as the client sees it.
  ends_at timestamptz NOT NULL,
  -- End of the time the barber is busy (ends_at + cleanup buffer).
  blocked_until timestamptz NOT NULL,
  hold_expires_at timestamptz,
  source public.booking_source NOT NULL,
  booked_by public.booking_actor NOT NULL,
  total_price_cents integer NOT NULL CHECK (total_price_cents >= 0),
  deposit_cents integer NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  client_note text,
  cancelled_at timestamptz,
  cancelled_by public.cancellation_party,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, id),
  FOREIGN KEY (shop_id, staff_id) REFERENCES public.staff (shop_id, id),
  FOREIGN KEY (shop_id, client_id) REFERENCES public.clients (shop_id, id),
  CHECK (ends_at > starts_at),
  CHECK (blocked_until >= ends_at),
  CHECK (deposit_cents <= total_price_cents),
  CHECK ((status = 'held') = (hold_expires_at IS NOT NULL)),
  CHECK (status IN ('held', 'expired') OR client_id IS NOT NULL),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)),

  -- No two live appointments for the same barber may overlap. Half-open
  -- ranges ('[)') mean a 10:00-10:30 cut and a 10:30 cut can sit back to back.
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, blocked_until, '[)') WITH &&
  ) WHERE (status IN ('held', 'confirmed', 'checked_in', 'completed'))
);

CREATE INDEX appointments_shop_starts_idx ON public.appointments (shop_id, starts_at);
CREATE INDEX appointments_client_idx ON public.appointments (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX appointments_stale_holds_idx ON public.appointments (hold_expires_at) WHERE status = 'held';

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Terminal states stay terminal. A cancelled or expired slot is rebooked as
-- a new appointment so history is never rewritten.
CREATE FUNCTION public.guard_appointment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('cancelled', 'expired') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'appointment % is % and cannot change status', OLD.id, OLD.status
      USING ERRCODE = 'LU422';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_guard_status
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.guard_appointment_status();

-- Snapshot of what was booked. Prices are copied so later price changes
-- never alter past appointments.
CREATE TABLE public.appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  service_id uuid,
  name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  is_addon boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shop_id, appointment_id) REFERENCES public.appointments (shop_id, id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, service_id) REFERENCES public.services (shop_id, id) ON DELETE SET NULL (service_id)
);

CREATE INDEX appointment_services_appointment_idx ON public.appointment_services (appointment_id);

-- ---------------------------------------------------------------------------
-- Booking write path. These functions are the only way appointments are
-- created or change hands between holds and bookings. They run with the
-- owner's privileges and are callable only by the server (service_role);
-- the booking API authorizes the caller and checks availability first.
-- ---------------------------------------------------------------------------

-- Error codes raised to the API:
--   LU404  not found / not bookable
--   LU409  slot no longer available
--   LU410  hold expired
--   LU422  invalid request

CREATE FUNCTION public.create_appointment(
  p_shop_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_service_ids uuid[],
  p_source public.booking_source,
  p_booked_by public.booking_actor,
  p_client_id uuid DEFAULT NULL,
  p_hold_minutes integer DEFAULT NULL,
  p_client_note text DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_duration integer;
  v_buffer integer;
  v_price integer;
  v_deposit integer;
  v_main_count integer;
  v_found integer;
  v_appointment public.appointments;
BEGIN
  IF p_service_ids IS NULL OR cardinality(p_service_ids) = 0 THEN
    RAISE EXCEPTION 'at least one service is required' USING ERRCODE = 'LU422';
  END IF;

  IF p_hold_minutes IS NULL AND p_client_id IS NULL THEN
    RAISE EXCEPTION 'a client is required to confirm a booking' USING ERRCODE = 'LU422';
  END IF;

  IF p_hold_minutes IS NOT NULL AND p_hold_minutes NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'hold must be between 1 and 30 minutes' USING ERRCODE = 'LU422';
  END IF;

  PERFORM 1 FROM public.staff
  WHERE id = p_staff_id AND shop_id = p_shop_id AND is_active AND is_bookable;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'barber is not bookable' USING ERRCODE = 'LU404';
  END IF;

  -- Resolve each service with the barber's overrides. The barber must offer
  -- every requested service, and the services must be active in this shop.
  SELECT
    count(*),
    count(*) FILTER (WHERE NOT s.is_addon),
    sum(coalesce(ss.duration_minutes, s.duration_minutes)),
    coalesce(max(s.buffer_after_minutes), 0),
    sum(coalesce(ss.price_cents, s.price_cents)),
    sum(s.deposit_cents)
  INTO v_found, v_main_count, v_duration, v_buffer, v_price, v_deposit
  FROM (SELECT DISTINCT unnest(p_service_ids) AS id) req
  JOIN public.services s ON s.id = req.id AND s.shop_id = p_shop_id AND s.is_active
  JOIN public.staff_services ss ON ss.service_id = s.id AND ss.staff_id = p_staff_id;

  IF v_found <> (SELECT count(DISTINCT x) FROM unnest(p_service_ids) x) THEN
    RAISE EXCEPTION 'one or more services are not offered by this barber' USING ERRCODE = 'LU404';
  END IF;

  IF v_main_count = 0 THEN
    RAISE EXCEPTION 'add-ons must be booked with a main service' USING ERRCODE = 'LU422';
  END IF;

  IF p_client_id IS NOT NULL THEN
    PERFORM 1 FROM public.clients WHERE id = p_client_id AND shop_id = p_shop_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'client not found' USING ERRCODE = 'LU404';
    END IF;
  END IF;

  -- Release this barber's timed-out holds so they don't block the slot.
  UPDATE public.appointments
  SET status = 'expired', hold_expires_at = NULL
  WHERE staff_id = p_staff_id AND status = 'held' AND hold_expires_at <= now();

  BEGIN
    INSERT INTO public.appointments (
      shop_id, staff_id, client_id, status, starts_at, ends_at, blocked_until,
      hold_expires_at, source, booked_by, total_price_cents, deposit_cents, client_note
    )
    VALUES (
      p_shop_id,
      p_staff_id,
      p_client_id,
      CASE WHEN p_hold_minutes IS NULL THEN 'confirmed' ELSE 'held' END::public.appointment_status,
      p_starts_at,
      p_starts_at + make_interval(mins => v_duration),
      p_starts_at + make_interval(mins => v_duration + v_buffer),
      CASE WHEN p_hold_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => p_hold_minutes) END,
      p_source,
      p_booked_by,
      v_price,
      v_deposit,
      p_client_note
    )
    RETURNING * INTO v_appointment;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'that time is no longer available' USING ERRCODE = 'LU409';
  END;

  INSERT INTO public.appointment_services (
    shop_id, appointment_id, service_id, name, duration_minutes, price_cents, is_addon
  )
  SELECT
    p_shop_id,
    v_appointment.id,
    s.id,
    s.name,
    coalesce(ss.duration_minutes, s.duration_minutes),
    coalesce(ss.price_cents, s.price_cents),
    s.is_addon
  FROM (SELECT DISTINCT unnest(p_service_ids) AS id) req
  JOIN public.services s ON s.id = req.id
  JOIN public.staff_services ss ON ss.service_id = s.id AND ss.staff_id = p_staff_id;

  RETURN v_appointment;
END;
$$;

-- Turns a live hold into a confirmed booking once the client has given
-- their details (and paid any deposit).
CREATE FUNCTION public.confirm_hold(p_appointment_id uuid, p_client_id uuid)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments;
BEGIN
  UPDATE public.appointments a
  SET status = 'confirmed', hold_expires_at = NULL, client_id = p_client_id
  WHERE a.id = p_appointment_id
    AND a.status = 'held'
    AND a.hold_expires_at > now()
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p_client_id AND c.shop_id = a.shop_id)
  RETURNING * INTO v_appointment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hold has expired or does not exist' USING ERRCODE = 'LU410';
  END IF;

  RETURN v_appointment;
END;
$$;

CREATE FUNCTION public.cancel_appointment(
  p_appointment_id uuid,
  p_cancelled_by public.cancellation_party,
  p_reason text DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments;
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled',
      hold_expires_at = NULL,
      cancelled_at = now(),
      cancelled_by = p_cancelled_by,
      cancellation_reason = p_reason
  WHERE id = p_appointment_id AND status IN ('held', 'confirmed', 'checked_in')
  RETURNING * INTO v_appointment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment cannot be cancelled' USING ERRCODE = 'LU422';
  END IF;

  RETURN v_appointment;
END;
$$;

-- Scheduled job: sweep every timed-out hold. create_appointment already
-- releases a barber's stale holds before booking; this keeps calendars tidy.
CREATE FUNCTION public.expire_stale_holds()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH expired AS (
    UPDATE public.appointments
    SET status = 'expired', hold_expires_at = NULL
    WHERE status = 'held' AND hold_expires_at <= now()
    RETURNING 1
  )
  SELECT count(*)::integer FROM expired;
$$;

-- Supabase grants EXECUTE to anon/authenticated through default privileges,
-- so revoking from PUBLIC alone would leave these callable from the browser.
REVOKE EXECUTE ON FUNCTION public.create_appointment FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_hold FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_holds FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_hold TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_appointment TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_holds TO service_role;
