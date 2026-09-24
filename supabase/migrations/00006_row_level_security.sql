-- Row-level security. Every table is scoped to a shop through staff
-- membership. A user can belong to several shops (e.g. a booth renter with
-- their own solo shop), so access comes from the staff table, not a single
-- JWT claim.
--
-- Clients never log in. Public booking goes through the server (service
-- role) and the booking functions, so anon gets no table access at all.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- The caller's active staff row in a shop, or null.
CREATE FUNCTION private.my_staff_id(p_shop_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.staff
  WHERE shop_id = p_shop_id AND user_id = auth.uid() AND is_active;
$$;

CREATE FUNCTION private.is_shop_member(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE shop_id = p_shop_id AND user_id = auth.uid() AND is_active
  );
$$;

-- Owners and managers run the shop: settings, staff, every calendar.
CREATE FUNCTION private.is_shop_manager(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE shop_id = p_shop_id AND user_id = auth.uid() AND is_active
      AND role IN ('owner', 'manager')
  );
$$;

-- Barbers see clients they have served or who prefer them, unless the shop
-- shares its client list between staff.
CREATE FUNCTION private.can_see_client(p_shop_id uuid, p_client_id uuid, p_preferred_staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    private.is_shop_manager(p_shop_id)
    OR (
      private.is_shop_member(p_shop_id)
      AND (
        (SELECT share_clients_between_staff FROM public.shops WHERE id = p_shop_id)
        OR p_preferred_staff_id = private.my_staff_id(p_shop_id)
        OR EXISTS (
          SELECT 1 FROM public.appointments
          WHERE client_id = p_client_id AND staff_id = private.my_staff_id(p_shop_id)
        )
      )
    );
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Shops: members read; managers edit. Shops are created by the server during onboarding.
CREATE POLICY shops_select ON public.shops FOR SELECT TO authenticated
  USING (private.is_shop_member(id));
CREATE POLICY shops_update ON public.shops FOR UPDATE TO authenticated
  USING (private.is_shop_manager(id)) WITH CHECK (private.is_shop_manager(id));

-- Staff: members see their colleagues; managers manage the roster.
CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated
  USING (private.is_shop_member(shop_id));
CREATE POLICY staff_insert ON public.staff FOR INSERT TO authenticated
  WITH CHECK (private.is_shop_manager(shop_id));
CREATE POLICY staff_update ON public.staff FOR UPDATE TO authenticated
  USING (private.is_shop_manager(shop_id)) WITH CHECK (private.is_shop_manager(shop_id));
CREATE POLICY staff_delete ON public.staff FOR DELETE TO authenticated
  USING (private.is_shop_manager(shop_id));

-- Payment accounts: visible to managers and to the barber who owns one.
-- Written only by the server during Stripe onboarding.
CREATE POLICY payment_accounts_select ON public.payment_accounts FOR SELECT TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

-- Services and menus: members read; managers edit.
CREATE POLICY services_select ON public.services FOR SELECT TO authenticated
  USING (private.is_shop_member(shop_id));
CREATE POLICY services_write ON public.services FOR ALL TO authenticated
  USING (private.is_shop_manager(shop_id)) WITH CHECK (private.is_shop_manager(shop_id));

-- A barber can set their own prices and durations; managers can set anyone's.
CREATE POLICY staff_services_select ON public.staff_services FOR SELECT TO authenticated
  USING (private.is_shop_member(shop_id));
CREATE POLICY staff_services_write ON public.staff_services FOR ALL TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

-- Hours and time off: a barber manages their own; managers manage everyone's.
CREATE POLICY working_hours_select ON public.working_hours FOR SELECT TO authenticated
  USING (private.is_shop_member(shop_id));
CREATE POLICY working_hours_write ON public.working_hours FOR ALL TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

CREATE POLICY time_off_select ON public.time_off FOR SELECT TO authenticated
  USING (private.is_shop_member(shop_id));
CREATE POLICY time_off_write ON public.time_off FOR ALL TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

-- Clients.
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
  USING (private.can_see_client(shop_id, id, preferred_staff_id));
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (private.is_shop_member(shop_id));
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
  USING (private.can_see_client(shop_id, id, preferred_staff_id))
  WITH CHECK (private.is_shop_member(shop_id));
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
  USING (private.is_shop_manager(shop_id));

-- Appointments: managers see the whole shop calendar; barbers see their own.
-- Creation, holds and cancellation go through the booking functions.
CREATE POLICY appointments_select ON public.appointments FOR SELECT TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY appointments_update ON public.appointments FOR UPDATE TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

CREATE POLICY appointment_services_select ON public.appointment_services FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_id
      AND (private.is_shop_manager(a.shop_id) OR a.staff_id = private.my_staff_id(a.shop_id))
  ));

-- Payments: managers see the shop's money; barbers see their own.
-- Staff can record cash and off-platform payments (and refunds of them) for
-- appointments they can see. Card rows come only from the server.
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY payments_insert_manual ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    method IN ('cash', 'external')
    AND recorded_by = auth.uid()
    AND (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
    -- The appointments subquery is itself filtered by RLS, so this only
    -- passes for appointments the caller can see.
    AND (appointment_id IS NULL OR EXISTS (
      SELECT 1 FROM public.appointments a WHERE a.id = appointment_id
    ))
  );
