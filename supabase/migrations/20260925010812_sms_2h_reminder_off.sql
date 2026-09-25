-- The 2-hour reminder is opt-in: every text costs money, and the day-before
-- reminder does most of the work. No shop has sent texts yet, so existing
-- shops take the new default too.
ALTER TABLE public.shops ALTER COLUMN sms_reminder_2h SET DEFAULT false;
UPDATE public.shops SET sms_reminder_2h = false;
