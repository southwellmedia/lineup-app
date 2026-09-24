-- Fixes from the Supabase security and performance advisors.

-- validate_refund() is a trigger helper, not an API. Triggers fire regardless
-- of EXECUTE privilege, so nobody needs to be able to call it directly.
REVOKE EXECUTE ON FUNCTION public.validate_refund() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_appointment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_payment_mutation() FROM PUBLIC, anon, authenticated;

-- Evaluate auth.uid() once per statement instead of once per row.
DROP POLICY payments_insert_manual ON public.payments;
CREATE POLICY payments_insert_manual ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    method IN ('cash', 'external')
    AND recorded_by = (SELECT auth.uid())
    AND (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
    -- The appointments subquery is itself filtered by RLS, so this only
    -- passes for appointments the caller can see.
    AND (appointment_id IS NULL OR EXISTS (
      SELECT 1 FROM public.appointments a WHERE a.id = appointment_id
    ))
  );

-- FOR ALL write policies also apply to SELECT, so every read evaluated two
-- policies. Split them into insert/update/delete.
DROP POLICY services_write ON public.services;
CREATE POLICY services_insert ON public.services FOR INSERT TO authenticated
  WITH CHECK (private.is_shop_manager(shop_id));
CREATE POLICY services_update ON public.services FOR UPDATE TO authenticated
  USING (private.is_shop_manager(shop_id)) WITH CHECK (private.is_shop_manager(shop_id));
CREATE POLICY services_delete ON public.services FOR DELETE TO authenticated
  USING (private.is_shop_manager(shop_id));

DROP POLICY staff_services_write ON public.staff_services;
CREATE POLICY staff_services_insert ON public.staff_services FOR INSERT TO authenticated
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY staff_services_update ON public.staff_services FOR UPDATE TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY staff_services_delete ON public.staff_services FOR DELETE TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

DROP POLICY working_hours_write ON public.working_hours;
CREATE POLICY working_hours_insert ON public.working_hours FOR INSERT TO authenticated
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY working_hours_update ON public.working_hours FOR UPDATE TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY working_hours_delete ON public.working_hours FOR DELETE TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

DROP POLICY time_off_write ON public.time_off;
CREATE POLICY time_off_insert ON public.time_off FOR INSERT TO authenticated
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY time_off_update ON public.time_off FOR UPDATE TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id))
  WITH CHECK (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));
CREATE POLICY time_off_delete ON public.time_off FOR DELETE TO authenticated
  USING (private.is_shop_manager(shop_id) OR staff_id = private.my_staff_id(shop_id));

-- Covering indexes for foreign keys, so deletes and joins on the parent
-- don't scan the child table.
CREATE INDEX appointment_services_shop_appointment_idx ON public.appointment_services (shop_id, appointment_id);
CREATE INDEX appointment_services_shop_service_idx ON public.appointment_services (shop_id, service_id);
CREATE INDEX appointments_shop_client_idx ON public.appointments (shop_id, client_id);
CREATE INDEX appointments_shop_staff_idx ON public.appointments (shop_id, staff_id);
CREATE INDEX clients_shop_preferred_staff_idx ON public.clients (shop_id, preferred_staff_id);
CREATE INDEX payment_accounts_shop_staff_idx ON public.payment_accounts (shop_id, staff_id);
CREATE INDEX payments_payment_account_idx ON public.payments (payment_account_id);
CREATE INDEX payments_recorded_by_idx ON public.payments (recorded_by);
CREATE INDEX payments_shop_appointment_idx ON public.payments (shop_id, appointment_id);
CREATE INDEX payments_shop_client_idx ON public.payments (shop_id, client_id);
CREATE INDEX payments_shop_staff_idx ON public.payments (shop_id, staff_id);
CREATE INDEX staff_services_shop_service_idx ON public.staff_services (shop_id, service_id);
CREATE INDEX staff_services_shop_staff_idx ON public.staff_services (shop_id, staff_id);
CREATE INDEX time_off_shop_staff_idx ON public.time_off (shop_id, staff_id);
CREATE INDEX working_hours_shop_staff_idx ON public.working_hours (shop_id, staff_id);

