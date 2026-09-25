-- Shop websites are cached at Vercel's CDN, tagged by shop. Whenever
-- anything a site shows changes (shop details, design, services, prices,
-- barbers, hours), these triggers ask the sites app to drop that shop's
-- cached pages, so edits show up on the next visit. The call goes out
-- through pg_net after commit; the URL and secret live in Vault
-- (sites_revalidate_url, sites_revalidate_secret). Without pg_net (plain
-- Postgres in tests) or the secrets, nothing is sent.

CREATE FUNCTION private.purge_site_cache(p_shop_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  IF p_shop_ids IS NULL OR cardinality(p_shop_ids) = 0 THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_net')
     OR to_regclass('vault.decrypted_secrets') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE $q$
    SELECT
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sites_revalidate_url'),
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'sites_revalidate_secret')
  $q$ INTO v_url, v_secret;
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'SELECT net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    USING
      v_url,
      jsonb_build_object('shops', to_jsonb(p_shop_ids)),
      jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret);
END;
$$;
REVOKE EXECUTE ON FUNCTION private.purge_site_cache(uuid[]) FROM PUBLIC, anon, authenticated;

-- Statement-level: one purge per statement, however many rows it touched
-- (reordering services updates them all at once).
CREATE FUNCTION private.purge_site_cache_for_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- TG_ARGV[0] names the shop column: "id" on shops, "shop_id" elsewhere.
  IF TG_OP = 'DELETE' THEN
    EXECUTE format('SELECT array_agg(DISTINCT %I) FROM old_rows', TG_ARGV[0]) INTO v_ids;
  ELSE
    EXECUTE format('SELECT array_agg(DISTINCT %I) FROM new_rows', TG_ARGV[0]) INTO v_ids;
  END IF;
  PERFORM private.purge_site_cache(v_ids);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.purge_site_cache_for_rows() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER shops_purge_site_cache
  AFTER UPDATE ON public.shops
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION private.purge_site_cache_for_rows('id');

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services', 'staff', 'staff_services', 'working_hours'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %1$s_purge_site_cache_ins AFTER INSERT ON public.%1$I
         REFERENCING NEW TABLE AS new_rows
         FOR EACH STATEMENT EXECUTE FUNCTION private.purge_site_cache_for_rows(''shop_id'')', t);
    EXECUTE format(
      'CREATE TRIGGER %1$s_purge_site_cache_upd AFTER UPDATE ON public.%1$I
         REFERENCING NEW TABLE AS new_rows
         FOR EACH STATEMENT EXECUTE FUNCTION private.purge_site_cache_for_rows(''shop_id'')', t);
    EXECUTE format(
      'CREATE TRIGGER %1$s_purge_site_cache_del AFTER DELETE ON public.%1$I
         REFERENCING OLD TABLE AS old_rows
         FOR EACH STATEMENT EXECUTE FUNCTION private.purge_site_cache_for_rows(''shop_id'')', t);
  END LOOP;
END
$$;
