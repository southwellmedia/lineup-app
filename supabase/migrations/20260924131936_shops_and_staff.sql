-- Tenancy: a shop is the tenant. A solo barber is a shop on the 'solo' plan
-- with a single staff member, so both personas share one data model.

CREATE TYPE public.shop_plan AS ENUM ('solo', 'shop');

CREATE TYPE public.staff_role AS ENUM ('owner', 'manager', 'barber');

CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  -- Used for the booking subdomain: {slug}.<root domain>
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  custom_domain text UNIQUE,
  timezone text NOT NULL DEFAULT 'America/Chicago' CHECK (public.is_valid_timezone(timezone)),
  plan public.shop_plan NOT NULL DEFAULT 'solo',

  -- Booking policy. Money is always integer cents.
  min_booking_notice_minutes integer NOT NULL DEFAULT 60 CHECK (min_booking_notice_minutes >= 0),
  max_booking_advance_days integer NOT NULL DEFAULT 60 CHECK (max_booking_advance_days > 0),
  slot_interval_minutes integer NOT NULL DEFAULT 15 CHECK (slot_interval_minutes BETWEEN 5 AND 120),
  cancellation_window_minutes integer NOT NULL DEFAULT 1440 CHECK (cancellation_window_minutes >= 0),
  late_cancel_fee_cents integer NOT NULL DEFAULT 0 CHECK (late_cancel_fee_cents >= 0),
  no_show_fee_cents integer NOT NULL DEFAULT 0 CHECK (no_show_fee_cents >= 0),
  -- When false, barbers only see clients they have served.
  share_clients_between_staff boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER shops_set_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  -- Null until the staff member accepts an invite and has a login.
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  role public.staff_role NOT NULL DEFAULT 'barber',
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  phone text,
  email text,
  bio text,
  -- Can clients book this person? Owners who don't cut set this to false.
  is_bookable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, slug),
  UNIQUE (shop_id, user_id),
  -- Lets child tables use composite FKs so a row can never point at another shop's staff.
  UNIQUE (shop_id, id)
);

CREATE INDEX staff_user_id_idx ON public.staff (user_id) WHERE user_id IS NOT NULL;

CREATE TRIGGER staff_set_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Where card money lands. Deliberately undecided whether the shop or each
-- barber is the merchant: an account belongs to exactly one of the two, so
-- both models (shop collects and pays out, or booth renters get paid
-- directly) work without a schema change. Cash payments never need one.
CREATE TYPE public.payment_provider AS ENUM ('stripe');

CREATE TABLE public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  -- Null means the account belongs to the shop; set means it belongs to that barber.
  staff_id uuid,
  provider public.payment_provider NOT NULL DEFAULT 'stripe',
  external_account_id text NOT NULL UNIQUE,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shop_id, staff_id) REFERENCES public.staff (shop_id, id) ON DELETE CASCADE
);

-- At most one shop-level account and one account per barber.
CREATE UNIQUE INDEX payment_accounts_shop_owner_uniq
  ON public.payment_accounts (shop_id) WHERE staff_id IS NULL;
CREATE UNIQUE INDEX payment_accounts_staff_owner_uniq
  ON public.payment_accounts (staff_id) WHERE staff_id IS NOT NULL;

CREATE TRIGGER payment_accounts_set_updated_at
  BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
