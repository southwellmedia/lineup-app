import { dangerouslyDeleteByTag } from "@vercel/functions";
import type { APIRoute } from "astro";
import { SITES_REVALIDATE_SECRET } from "astro:env/server";
import { timingSafeEqual } from "node:crypto";
import { shopCacheTag } from "../../lib/page";

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(header: string | null): boolean {
  if (!SITES_REVALIDATE_SECRET || !header) return false;
  const expected = Buffer.from(`Bearer ${SITES_REVALIDATE_SECRET}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Drops the cached pages of the given shops so the next visit renders fresh.
 * Called by the database (pg_net) whenever a shop's site data changes.
 * Body: { "shops": ["<shop id>", ...] }.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!authorized(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { shops?: unknown } | null;
  const shops = Array.isArray(body?.shops)
    ? body.shops.filter((id): id is string => typeof id === "string" && UUID.test(id))
    : [];
  if (!shops.length) return new Response("No shops", { status: 400 });

  // Only Vercel's CDN caches pages; elsewhere (local dev) there's nothing to drop.
  if (process.env.VERCEL) await dangerouslyDeleteByTag(shops.slice(0, 16).map(shopCacheTag));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
