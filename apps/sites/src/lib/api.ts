import type { SiteData } from "@lineup/site-kit";
import { LINEUP_API_BYPASS, LINEUP_API_URL } from "astro:env/server";

/**
 * Fetches a shop's site data. No caching here: rendered pages are cached at
 * the CDN and purged by tag when the shop changes, so a local copy could
 * only ever serve something stale.
 */
async function fetchSite(path: string): Promise<SiteData | null> {
  const response = await fetch(new URL(path, LINEUP_API_URL), {
    headers: LINEUP_API_BYPASS ? { "x-vercel-protection-bypass": LINEUP_API_BYPASS } : {},
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Site API ${response.status} for ${path}`);
  return (await response.json()) as SiteData;
}

/**
 * `preview` (the dashboard's live preview) skips every cache and may show
 * another template's saved content.
 */
export function siteBySlug(
  slug: string,
  preview?: { template?: string | null },
): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{1,63}$/.test(slug)) return Promise.resolve(null);
  if (!preview) return fetchSite(`/api/public/sites/${slug}`);
  const query = new URLSearchParams({ preview: "1" });
  if (preview.template && /^[a-z-]{1,40}$/.test(preview.template)) {
    query.set("template", preview.template);
  }
  return fetchSite(`/api/public/sites/${slug}?${query}`);
}

export function siteByDomain(domain: string): Promise<SiteData | null> {
  return fetchSite(`/api/public/sites?domain=${encodeURIComponent(domain)}`);
}

/**
 * Forwards an analytics event to the web app with the visitor's IP and user
 * agent, which the web app turns into a daily anonymous id. Best effort.
 */
export async function sendEvent(
  slug: string,
  body: unknown,
  client: { ip: string; userAgent: string },
): Promise<void> {
  try {
    await fetch(new URL(`/api/public/sites/${slug}/events`, LINEUP_API_URL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-lineup-client-ip": client.ip,
        "x-lineup-client-ua": client.userAgent,
        ...(LINEUP_API_BYPASS ? { "x-vercel-protection-bypass": LINEUP_API_BYPASS } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Analytics never breaks the site.
  }
}
