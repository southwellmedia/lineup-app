-- Photos of clients' cuts: private by default, shared only with consent.

-- The client's Instagram handle, for tagging when they've agreed to it, and
-- whether they're a child (kids' photos never leave the shop).
ALTER TABLE public.clients
  ADD COLUMN instagram text CHECK (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  ADD COLUMN is_minor boolean NOT NULL DEFAULT false;

-- How far a photo may travel: the client's history only, the shop's
-- website, or social media (with a tag if they gave a handle).
CREATE TYPE public.photo_consent AS ENUM ('private', 'portfolio', 'social');

CREATE TABLE public.client_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  appointment_id uuid,
  taken_by uuid,
  -- Object in the private client-photos bucket: "<shop>/<client>/<file>".
  path text NOT NULL UNIQUE,
  caption text CHECK (length(caption) <= 300),
  consent public.photo_consent NOT NULL DEFAULT 'private',
  consent_at timestamptz,
  consent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shop_id, client_id) REFERENCES public.clients (shop_id, id) ON DELETE CASCADE,
  FOREIGN KEY (shop_id, appointment_id) REFERENCES public.appointments (shop_id, id)
    ON DELETE SET NULL (appointment_id),
  FOREIGN KEY (shop_id, taken_by) REFERENCES public.staff (shop_id, id) ON DELETE SET NULL (taken_by),
  CHECK (path = shop_id::text || '/' || client_id::text || '/' || split_part(path, '/', 3)
    AND split_part(path, '/', 3) ~ '^[A-Za-z0-9._-]{1,120}$'),
  -- Anything beyond private needs a recorded moment of consent.
  CHECK (consent = 'private' OR consent_at IS NOT NULL)
);

CREATE INDEX client_photos_client_idx ON public.client_photos (client_id, created_at DESC);
CREATE INDEX client_photos_appointment_idx ON public.client_photos (appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Kids' photos stay private, whatever the API or a script asks for.
CREATE FUNCTION public.guard_photo_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.consent <> 'private'
     AND (SELECT is_minor FROM public.clients WHERE id = NEW.client_id) THEN
    RAISE EXCEPTION 'photos of children stay private' USING ERRCODE = 'LU422';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER client_photos_guard_consent
  BEFORE INSERT OR UPDATE OF consent ON public.client_photos
  FOR EACH ROW EXECUTE FUNCTION public.guard_photo_consent();

-- Whether the signed-in staff member can see this client of this shop:
-- the same rule as the clients table.
CREATE FUNCTION private.can_see_client_in(p_shop_id uuid, p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = p_client_id AND c.shop_id = p_shop_id
      AND private.can_see_client(c.shop_id, c.id, c.preferred_staff_id)
  );
$$;

-- "<shop>/<client>/<file>" → the shop and client ids, or nulls.
CREATE FUNCTION private.client_photo_owner(p_name text, OUT shop_id uuid, OUT client_id uuid)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    CASE WHEN p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' THEN split_part(p_name, '/', 1)::uuid END,
    CASE WHEN p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' THEN split_part(p_name, '/', 2)::uuid END;
$$;

REVOKE EXECUTE ON FUNCTION private.can_see_client_in(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.client_photo_owner(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_see_client_in(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.client_photo_owner(text) TO authenticated, service_role;

ALTER TABLE public.client_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_photos_select ON public.client_photos FOR SELECT TO authenticated
  USING (private.can_see_client_in(shop_id, client_id));
CREATE POLICY client_photos_insert ON public.client_photos FOR INSERT TO authenticated
  WITH CHECK (
    private.can_see_client_in(shop_id, client_id)
    AND taken_by = private.my_staff_id(shop_id)
  );
CREATE POLICY client_photos_update ON public.client_photos FOR UPDATE TO authenticated
  USING (private.can_see_client_in(shop_id, client_id))
  WITH CHECK (private.can_see_client_in(shop_id, client_id));
CREATE POLICY client_photos_delete ON public.client_photos FOR DELETE TO authenticated
  USING (private.is_shop_manager(shop_id) OR taken_by = private.my_staff_id(shop_id));

-- Private bucket: files are only reachable through short-lived signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-photos', 'client-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY client_photos_objects_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND private.can_see_client_in(
      (private.client_photo_owner(name)).shop_id,
      (private.client_photo_owner(name)).client_id
    )
  );
CREATE POLICY client_photos_objects_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-photos'
    AND private.can_see_client_in(
      (private.client_photo_owner(name)).shop_id,
      (private.client_photo_owner(name)).client_id
    )
  );
CREATE POLICY client_photos_objects_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-photos'
    AND private.can_see_client_in(
      (private.client_photo_owner(name)).shop_id,
      (private.client_photo_owner(name)).client_id
    )
  );
