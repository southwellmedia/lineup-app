-- Text messages: booking confirmations, reminders and client replies.

-- Per-shop switches. Texts only ever go to clients who agreed to them
-- (clients.sms_consent_at), and a STOP reply withdraws that.
ALTER TABLE public.shops
  ADD COLUMN sms_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN sms_reminder_24h boolean NOT NULL DEFAULT true,
  ADD COLUMN sms_reminder_2h boolean NOT NULL DEFAULT true;

-- When the client confirmed by replying C.
ALTER TABLE public.appointments ADD COLUMN client_confirmed_at timestamptz;

CREATE TYPE public.message_kind AS ENUM (
  'confirmation', 'reminder_24h', 'reminder_2h', 'reply', 'inbound'
);
CREATE TYPE public.message_status AS ENUM ('queued', 'sent', 'failed', 'skipped', 'received');

-- Every text in or out. Written only by the server.
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops (id) ON DELETE CASCADE,
  client_id uuid,
  appointment_id uuid,
  direction text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  kind public.message_kind NOT NULL,
  phone text NOT NULL,
  body text NOT NULL CHECK (length(body) <= 1600),
  status public.message_status NOT NULL,
  provider_id text,
  error text CHECK (length(error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shop_id, client_id) REFERENCES public.clients (shop_id, id) ON DELETE SET NULL (client_id),
  FOREIGN KEY (shop_id, appointment_id) REFERENCES public.appointments (shop_id, id)
    ON DELETE SET NULL (appointment_id)
);

-- One confirmation and one of each reminder per booking, however many
-- times a job or request retries.
CREATE UNIQUE INDEX messages_once_per_booking
  ON public.messages (appointment_id, kind)
  WHERE direction = 'outbound' AND kind IN ('confirmation', 'reminder_24h', 'reminder_2h');
CREATE INDEX messages_phone_idx ON public.messages (phone, created_at DESC);
CREATE INDEX messages_appointment_idx ON public.messages (appointment_id) WHERE appointment_id IS NOT NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Staff see the texts of clients they can see; managers see the shop's.
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (
    private.is_shop_manager(shop_id)
    OR (client_id IS NOT NULL AND private.can_see_client_in(shop_id, client_id))
  );

-- Reminders run every 15 minutes: pg_cron calls the web app's reminder
-- route, whose URL and secret live in Vault (reminders_url, cron_secret).
-- Skipped where pg_cron isn't available (plain Postgres in tests).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
    PERFORM cron.schedule(
      'text-reminders',
      '*/15 * * * *',
      $job$
        SELECT net.http_get(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_url'),
          headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
          ),
          timeout_milliseconds := 20000
        )
        WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'reminders_url');
      $job$
    );
  END IF;
END
$$;
