-- Services, per-barber overrides, working hours and time off.

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 600),
  -- Cleanup time after the service; blocks the calendar but isn't shown to clients.
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes BETWEEN 0 AND 120),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  deposit_cents integer NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  -- Add-ons (beard, design, eyebrows) are booked alongside a main service and extend the slot.
  is_addon boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, id),
  CHECK (deposit_cents <= price_cents)
);

CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Which barbers offer which services, with optional per-barber price/duration.
CREATE TABLE public.staff_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  service_id uuid NOT NULL,
  price_cents integer CHECK (price_cents >= 0),
  duration_minutes integer CHECK (duration_minutes BETWEEN 5 AND 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, service_id),
  FOREIGN KEY (shop_id, staff_id) REFERENCES public.staff (shop_id, id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, service_id) REFERENCES public.services (shop_id, id) ON DELETE CASCADE
);

CREATE TRIGGER staff_services_set_updated_at
  BEFORE UPDATE ON public.staff_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Weekly recurring hours in the shop's local time. Several rows on one day
-- express breaks (e.g. 09:00-12:00 and 13:00-18:00).
CREATE TABLE public.working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  -- 0 = Sunday ... 6 = Saturday (matches JS Date#getDay and Postgres extract(dow)).
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  FOREIGN KEY (shop_id, staff_id) REFERENCES public.staff (shop_id, id) ON DELETE CASCADE
);

CREATE INDEX working_hours_staff_idx ON public.working_hours (staff_id, weekday);

CREATE TRIGGER working_hours_set_updated_at
  BEFORE UPDATE ON public.working_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One-off blocks: vacation, a doctor's appointment, a long lunch.
CREATE TABLE public.time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  during tstzrange NOT NULL CHECK (NOT isempty(during) AND NOT lower_inf(during) AND NOT upper_inf(during)),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shop_id, staff_id) REFERENCES public.staff (shop_id, id) ON DELETE CASCADE
);

CREATE INDEX time_off_staff_during_idx ON public.time_off USING gist (staff_id, during);

CREATE TRIGGER time_off_set_updated_at
  BEFORE UPDATE ON public.time_off
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
