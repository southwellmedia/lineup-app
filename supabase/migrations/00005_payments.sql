-- Payments ledger. Rows are immutable: refunds and corrections are new rows
-- that reference the original. Money is integer cents.
--
-- Cash (and other off-platform methods like Cash App or Zelle) work from day
-- one: staff mark a booking as paid and a ledger row is recorded. Card rows
-- arrive later from Stripe webhooks and are the only rows that carry
-- Stripe ids and a payment account.

CREATE TYPE public.payment_method AS ENUM (
  'cash',
  'external',  -- paid outside the platform: Cash App, Zelle, Venmo, another card reader
  'card'       -- processed by us through Stripe
);

CREATE TYPE public.payment_kind AS ENUM (
  'deposit',
  'service',
  'no_show_fee',
  'late_cancel_fee',
  'refund'
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE RESTRICT,
  appointment_id uuid,
  client_id uuid,
  -- The barber this money is attributed to (service, tips, commission reporting).
  staff_id uuid,
  kind public.payment_kind NOT NULL,
  method public.payment_method NOT NULL,
  -- Positive for money in; negative for refunds.
  amount_cents integer NOT NULL,
  tip_cents integer NOT NULL DEFAULT 0,
  processing_fee_cents integer NOT NULL DEFAULT 0 CHECK (processing_fee_cents >= 0),
  platform_fee_cents integer NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  refunds_payment_id uuid REFERENCES public.payments (id) ON DELETE RESTRICT,
  payment_account_id uuid REFERENCES public.payment_accounts (id) ON DELETE RESTRICT,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_refund_id text UNIQUE,
  note text,
  recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shop_id, appointment_id) REFERENCES public.appointments (shop_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id, client_id) REFERENCES public.clients (shop_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (shop_id, staff_id) REFERENCES public.staff (shop_id, id) ON DELETE RESTRICT,

  -- Money in is positive and never a refund; refunds are negative and point at what they refund.
  CHECK (
    (kind <> 'refund' AND amount_cents >= 0 AND tip_cents >= 0 AND amount_cents + tip_cents > 0
      AND refunds_payment_id IS NULL)
    OR
    (kind = 'refund' AND amount_cents <= 0 AND tip_cents <= 0 AND amount_cents + tip_cents < 0
      AND refunds_payment_id IS NOT NULL)
  ),
  -- Card money always has a Stripe trail and a destination account; off-platform money never does.
  CHECK (
    (method = 'card' AND payment_account_id IS NOT NULL AND stripe_payment_intent_id IS NOT NULL)
    OR
    (method <> 'card' AND payment_account_id IS NULL AND stripe_payment_intent_id IS NULL
      AND stripe_charge_id IS NULL AND stripe_refund_id IS NULL
      AND processing_fee_cents = 0 AND platform_fee_cents = 0)
  )
);

CREATE INDEX payments_shop_created_idx ON public.payments (shop_id, created_at);
CREATE INDEX payments_appointment_idx ON public.payments (appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX payments_refunds_idx ON public.payments (refunds_payment_id) WHERE refunds_payment_id IS NOT NULL;
-- A Stripe charge is recorded once, even if its webhook is delivered twice.
CREATE UNIQUE INDEX payments_stripe_intent_uniq
  ON public.payments (stripe_payment_intent_id) WHERE kind <> 'refund';

CREATE FUNCTION public.prevent_payment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'payments are immutable; record a refund or correction instead'
    USING ERRCODE = 'LU422';
END;
$$;

CREATE TRIGGER payments_immutable
  BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_mutation();

-- A refund must match its original's shop, method and appointment, and all
-- refunds together can never exceed what was paid.
-- Runs as owner so it sees (and can lock) every row for the check, whatever
-- the inserting user's row-level access.
CREATE FUNCTION public.validate_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_original public.payments;
  v_already_refunded integer;
BEGIN
  IF NEW.kind <> 'refund' THEN
    RETURN NEW;
  END IF;

  -- Lock the original so concurrent refunds are checked one at a time.
  SELECT * INTO v_original FROM public.payments WHERE id = NEW.refunds_payment_id FOR UPDATE;

  IF v_original.kind = 'refund' THEN
    RAISE EXCEPTION 'cannot refund a refund' USING ERRCODE = 'LU422';
  END IF;

  IF v_original.shop_id <> NEW.shop_id
     OR v_original.method <> NEW.method
     OR v_original.appointment_id IS DISTINCT FROM NEW.appointment_id THEN
    RAISE EXCEPTION 'refund must match the original payment''s shop, method and appointment'
      USING ERRCODE = 'LU422';
  END IF;

  SELECT coalesce(-sum(amount_cents + tip_cents), 0) INTO v_already_refunded
  FROM public.payments WHERE refunds_payment_id = NEW.refunds_payment_id;

  IF v_already_refunded - (NEW.amount_cents + NEW.tip_cents)
     > v_original.amount_cents + v_original.tip_cents THEN
    RAISE EXCEPTION 'refund exceeds the amount paid' USING ERRCODE = 'LU422';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_validate_refund
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_refund();

-- What each appointment has been paid, net of refunds. Tips and fees are
-- reported separately so "balance due" only ever means the service price.
CREATE VIEW public.appointment_balances
WITH (security_invoker = true)
AS
SELECT
  a.id AS appointment_id,
  a.shop_id,
  a.total_price_cents,
  coalesce(sum(p.amount_cents) FILTER (WHERE coalesce(o.kind, p.kind) IN ('deposit', 'service')), 0)::integer
    AS paid_cents,
  coalesce(sum(p.tip_cents), 0)::integer AS tip_cents,
  coalesce(sum(p.amount_cents) FILTER (WHERE coalesce(o.kind, p.kind) IN ('no_show_fee', 'late_cancel_fee')), 0)::integer
    AS fees_cents,
  greatest(
    a.total_price_cents
      - coalesce(sum(p.amount_cents) FILTER (WHERE coalesce(o.kind, p.kind) IN ('deposit', 'service')), 0),
    0
  )::integer AS balance_due_cents
FROM public.appointments a
LEFT JOIN public.payments p ON p.appointment_id = a.id
LEFT JOIN public.payments o ON o.id = p.refunds_payment_id
GROUP BY a.id;

-- "Mark as paid" for cash and off-platform payments. Runs as the calling
-- staff member, so row-level security decides whether they may do it.
-- With no amount given, it records whatever is still owed. A confirmed or
-- checked-in appointment is marked completed.
CREATE FUNCTION public.record_manual_payment(
  p_appointment_id uuid,
  p_method public.payment_method,
  p_amount_cents integer DEFAULT NULL,
  p_tip_cents integer DEFAULT 0,
  p_note text DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments;
  v_balance integer;
  v_amount integer;
  v_payment public.payments;
BEGIN
  IF p_method = 'card' THEN
    RAISE EXCEPTION 'card payments are recorded by the payment processor' USING ERRCODE = 'LU422';
  END IF;

  SELECT * INTO v_appointment FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found' USING ERRCODE = 'LU404';
  END IF;

  IF v_appointment.status NOT IN ('confirmed', 'checked_in', 'completed') THEN
    RAISE EXCEPTION 'cannot take payment for a % appointment', v_appointment.status
      USING ERRCODE = 'LU422';
  END IF;

  SELECT balance_due_cents INTO v_balance
  FROM public.appointment_balances WHERE appointment_id = p_appointment_id;

  v_amount := coalesce(p_amount_cents, v_balance);

  IF v_amount < 0 OR coalesce(p_tip_cents, 0) < 0 OR v_amount + coalesce(p_tip_cents, 0) = 0 THEN
    RAISE EXCEPTION 'nothing to record: the appointment is already paid' USING ERRCODE = 'LU422';
  END IF;

  INSERT INTO public.payments (
    shop_id, appointment_id, client_id, staff_id, kind, method,
    amount_cents, tip_cents, note, recorded_by
  )
  VALUES (
    v_appointment.shop_id, v_appointment.id, v_appointment.client_id, v_appointment.staff_id,
    'service', p_method, v_amount, coalesce(p_tip_cents, 0), p_note, auth.uid()
  )
  RETURNING * INTO v_payment;

  IF v_appointment.status IN ('confirmed', 'checked_in') THEN
    UPDATE public.appointments SET status = 'completed' WHERE id = v_appointment.id;
  END IF;

  RETURN v_payment;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_manual_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_payment TO authenticated, service_role;
