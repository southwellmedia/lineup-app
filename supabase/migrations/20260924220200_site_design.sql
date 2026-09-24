-- Website templates and their content, plus a bucket for site photos.

-- Which template the shop's site uses and, per template, its sections and
-- their settings (see packages/site-kit/src/design.ts). Validated by the API;
-- the site falls back to defaults for anything it can't read.
ALTER TABLE public.shops
  ADD COLUMN site_template text NOT NULL DEFAULT 'classic'
    CHECK (site_template IN ('classic', 'contact-sheet')),
  ADD COLUMN site_content jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(site_content) = 'object' AND pg_column_size(site_content) < 200000);

-- Photos for shop websites. Public, because websites are; files live under
-- "<shop id>/" and only that shop's owners and managers can change them.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- The shop a site-media object belongs to, or null if the path isn't
-- "<uuid>/<file>". Keeps the policies from erroring on odd names.
CREATE FUNCTION private.site_media_shop(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
      THEN split_part(p_name, '/', 1)::uuid
  END;
$$;
REVOKE EXECUTE ON FUNCTION private.site_media_shop(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.site_media_shop(text) TO authenticated, service_role;

CREATE POLICY site_media_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-media' AND private.is_shop_manager(private.site_media_shop(name)));
CREATE POLICY site_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND private.is_shop_manager(private.site_media_shop(name)));
CREATE POLICY site_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND private.is_shop_manager(private.site_media_shop(name)))
  WITH CHECK (bucket_id = 'site-media' AND private.is_shop_manager(private.site_media_shop(name)));
CREATE POLICY site_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND private.is_shop_manager(private.site_media_shop(name)));
