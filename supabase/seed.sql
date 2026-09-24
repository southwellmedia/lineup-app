-- Local development data: one Dallas shop with two barbers, a menu and
-- weekly hours. Staff have no login yet (user_id is null); link one to your
-- local auth user to sign in as them.

INSERT INTO public.shops (id, name, slug, plan, timezone, no_show_fee_cents, late_cancel_fee_cents)
VALUES ('00000000-0000-4000-8000-000000000001', 'Southside Cuts', 'southside-cuts', 'shop', 'America/Chicago', 2000, 1000);

INSERT INTO public.staff (id, shop_id, role, display_name, slug, sort_order) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'owner', 'Marcus', 'marcus', 0),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'barber', 'Andre', 'andre', 1);

INSERT INTO public.services
  (id, shop_id, name, duration_minutes, buffer_after_minutes, price_cents, deposit_cents, is_addon, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Fade', 30, 5, 3500, 1000, false, 0),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Taper', 30, 5, 3000, 0, false, 1),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'Kids Cut', 25, 5, 2500, 0, false, 2),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'Beard Trim', 15, 0, 1500, 0, true, 3),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', 'Design', 10, 0, 1000, 0, true, 4);

-- Both barbers offer everything; Marcus charges more for a fade.
INSERT INTO public.staff_services (shop_id, staff_id, service_id, price_cents)
SELECT s.shop_id, st.id, s.id,
       CASE WHEN st.slug = 'marcus' AND s.name = 'Fade' THEN 4000 END
FROM public.services s
JOIN public.staff st ON st.shop_id = s.shop_id;

-- Tuesday-Friday 10:00-19:00 with a 14:00-14:30 lunch; Saturday 08:00-16:00.
INSERT INTO public.working_hours (shop_id, staff_id, weekday, start_time, end_time)
SELECT st.shop_id, st.id, d.weekday, h.start_time, h.end_time
FROM public.staff st
CROSS JOIN (VALUES (2), (3), (4), (5)) AS d (weekday)
CROSS JOIN (VALUES ('10:00'::time, '14:00'::time), ('14:30'::time, '19:00'::time)) AS h (start_time, end_time)
UNION ALL
SELECT st.shop_id, st.id, 6, '08:00', '16:00'
FROM public.staff st;

INSERT INTO public.clients (shop_id, phone, name, preferred_staff_id, sms_consent_at) VALUES
  ('00000000-0000-4000-8000-000000000001', '+12145550101', 'Jordan Ellis', '00000000-0000-4000-8000-000000000101', now()),
  ('00000000-0000-4000-8000-000000000001', '+12145550102', 'Luis Ramirez', '00000000-0000-4000-8000-000000000102', now()),
  ('00000000-0000-4000-8000-000000000001', '+12145550103', 'DeShawn Carter', NULL, NULL);
