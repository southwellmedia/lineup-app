import type { APIRoute } from "astro";
import { sendEvent } from "../../../lib/api";

/**
 * Receives the site's page-view and Book-click beacons. Same origin as the
 * site (on custom domains too, via the middleware rewrite), so no CORS and
 * fewer blocked requests. Always 204.
 */
export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  const slug = params.shop ?? "";
  const text = await request.text();
  if (/^[a-z0-9-]{1,63}$/.test(slug) && text.length <= 2000) {
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // ignore malformed beacons
    }
    if (body && typeof body === "object") {
      const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      await sendEvent(slug, body, {
        ip: forwarded || clientAddress || "",
        userAgent: request.headers.get("user-agent") ?? "",
      });
    }
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
