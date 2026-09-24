-- Booking from the staff calendar: walk-ins can be name-only, and live
-- bookings can be moved to another time or barber.

-- Walk-ins often don't leave a number. Online and phone bookings still
-- require one (the API enforces that). UNIQUE (shop_id, phone) ignores NULLs,
-- so any number of name-only clients can exist.
ALTER TABLE public.clients ALTER COLUMN phone DROP NOT NULL;

-- Moves a confirmed booking to a new start time and/or barber. The booked
-- services, prices and length stay as they were (the snapshot); the
-- exclusion constraint still rejects any overlap.
CREATE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_staff_id uuid
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments;
BEGIN
  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found' USING ERRCODE = 'LU404';
  END IF;

  IF v_appointment.status <> 'confirmed' THEN
    RAISE EXCEPTION 'only confirmed appointments can be moved' USING ERRCODE = 'LU422';
  END IF;

  PERFORM 1 FROM public.staff
  WHERE id = p_staff_id AND shop_id = v_appointment.shop_id AND is_active AND is_bookable;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'barber is not bookable' USING ERRCODE = 'LU404';
  END IF;

  -- A different barber must offer every booked service that still exists.
  IF p_staff_id <> v_appointment.staff_id THEN
    PERFORM 1
    FROM public.appointment_services x
    WHERE x.appointment_id = v_appointment.id
      AND x.service_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.staff_services ss
        WHERE ss.staff_id = p_staff_id AND ss.service_id = x.service_id
      );
    IF FOUND THEN
      RAISE EXCEPTION 'that barber does not offer these services' USING ERRCODE = 'LU404';
    END IF;
  END IF;

  BEGIN
    UPDATE public.appointments
    SET staff_id = p_staff_id,
        starts_at = p_starts_at,
        ends_at = p_starts_at + (v_appointment.ends_at - v_appointment.starts_at),
        blocked_until = p_starts_at + (v_appointment.blocked_until - v_appointment.starts_at)
    WHERE id = v_appointment.id
    RETURNING * INTO v_appointment;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'that time is no longer available' USING ERRCODE = 'LU409';
  END;

  RETURN v_appointment;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, timestamptz, uuid) TO service_role;
