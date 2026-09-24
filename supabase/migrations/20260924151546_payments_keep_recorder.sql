-- payments.recorded_by had ON DELETE SET NULL, but payments are immutable, so
-- deleting any user who had ever recorded a payment failed. The ledger keeps
-- who recorded each row as a plain audit value instead, even after that
-- login is removed.
ALTER TABLE public.payments DROP CONSTRAINT payments_recorded_by_fkey;

COMMENT ON COLUMN public.payments.recorded_by IS
  'auth.users id of whoever recorded the payment. Kept for audit even after the user is deleted; no foreign key.';
