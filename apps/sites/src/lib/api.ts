import type { SiteData } from "@lineup/site-kit";
import { LINEUP_API_BYPASS, LINEUP_API_URL } from "astro:env/server";

type Entry = { site: SiteData | null; expires: number };

/** Small per-instance cache; the API is also edge-cached, this just saves a hop. */
const cache = new Map<string, Entry>();
const TTL_MS = 30_000;

async function fetchSite(path: string): Promise<SiteData | null> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.site;

  const response = await fetch(new URL(path, LINEUP_API_URL), {
    headers: LINEUP_API_BYPASS ? { "x-vercel-protection-bypass": LINEUP_API_BYPASS } : {},
  });
  if (response.status === 404) {
    cache.set(path, { site: null, expires: Date.now() + TTL_MS });
    return null;
  }
  if (!response.ok) throw new Error(`Site API ${response.status} for ${path}`);
  const site = (await response.json()) as SiteData;
  cache.set(path, { site, expires: Date.now() + TTL_MS });
  return site;
}

export function siteBySlug(slug: string): Promise<SiteData | null> {
  if (!/^[a-z0-9-]{1,63}$/.test(slug)) return Promise.resolve(null);
  return fetchSite(`/api/public/sites/${slug}`);
}

export function siteByDomain(domain: string): Promise<SiteData | null> {
  return fetchSite(`/api/public/sites?domain=${encodeURIComponent(domain)}`);
}
