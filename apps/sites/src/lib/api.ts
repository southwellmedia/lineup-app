import type { SiteData } from "@lineup/site-kit";
import { LINEUP_API_BYPASS, LINEUP_API_URL } from "astro:env/server";

type Entry = { site: SiteData | null; expires: number };

/** Small per-instance cache; the API is also edge-cached, this just saves a hop. */
const cache = new Map<string, Entry>();
const TTL_MS = 30_000;

async function fetchSite(path: string, preview = false): Promise<SiteData | null> {
  const hit = preview ? undefined : cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.site;

  const response = await fetch(new URL(path, LINEUP_API_URL), {
    headers: LINEUP_API_BYPASS ? { "x-vercel-protection-bypass": LINEUP_API_BYPASS } : {},
    cache: preview ? "no-store" : "default",
  });
  if (response.status === 404) {
    cache.set(path, { site: null, expires: Date.now() + TTL_MS });
    return null;
  }
  if (!response.ok) throw new Error(`Site API ${response.status} for ${path}`);
  const site = (await response.json()) as SiteData;
  if (!preview) cache.set(path, { site, expires: Date.now() + TTL_MS });
  return site;
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
  return fetchSite(`/api/public/sites/${slug}?${query}`, true);
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
