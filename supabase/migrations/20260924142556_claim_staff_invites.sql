-- Staff are invited by email before they have a login. The first time they
-- sign in with that email, their staff rows are linked to their account.

CREATE INDEX staff_unclaimed_email_idx
  ON public.staff (lower(email))
  WHERE user_id IS NULL AND email IS NOT NULL;

-- Links the signed-in user to every active, unclaimed staff row carrying
-- their (verified) email, skipping shops they already belong to. Returns how
-- many rows were claimed. Supabase only issues a JWT email once it has been
-- verified by a magic link or code, so the email can be trusted here.
CREATE FUNCTION public.claim_staff_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_count integer;
BEGIN
  IF v_user IS NULL OR v_email IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.staff s
  SET user_id = v_user
  WHERE lower(s.email) = v_email
    AND s.user_id IS NULL
    AND s.is_active
    AND NOT EXISTS (
      SELECT 1 FROM public.staff mine WHERE mine.shop_id = s.shop_id AND mine.user_id = v_user
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_staff_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_staff_invites() TO authenticated;
