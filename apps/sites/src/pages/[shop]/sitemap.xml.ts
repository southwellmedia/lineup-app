import type { APIRoute } from "astro";
import { pageContext, shopCacheTag } from "../../lib/page";

/** Every public page of the shop's site, for search engines. */
export const GET: APIRoute = async ({ params, url, locals }) => {
  const ctx = await pageContext(params.shop, url, locals.hostMode);
  if (!ctx) return new Response("Not found", { status: 404 });

  const paths = [
    "/",
    ...ctx.site.services.filter((s) => !s.isAddon).map((s) => `/services/${s.slug}`),
    ...ctx.site.barbers.map((b) => `/barbers/${b.slug}`),
  ];
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${escape(ctx.canonical(p))}</loc></url>`).join("\n")}
</urlset>
`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "vercel-cdn-cache-control": "public, s-maxage=86400",
      "vercel-cache-tag": shopCacheTag(ctx.site.shop.id),
    },
  });
};
