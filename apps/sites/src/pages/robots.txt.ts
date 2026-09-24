import type { APIRoute } from "astro";
import { SITES_ROOT_DOMAIN } from "astro:env/server";
import { resolveTenant } from "../lib/tenant";

/** On a shop's own host, point crawlers at its sitemap. The platform host itself isn't indexed. */
export const GET: APIRoute = ({ request, url }) => {
  const tenant = resolveTenant(request.headers.get("host") ?? url.host, SITES_ROOT_DOMAIN);
  const body =
    tenant.kind === "path"
      ? "User-agent: *\nAllow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${url.origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
