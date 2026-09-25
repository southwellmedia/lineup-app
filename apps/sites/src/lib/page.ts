import { bookingLink, mediaUrl, type MediaRef, type SiteData } from "@lineup/site-kit";
import { siteBySlug } from "./api";

export type PageContext = {
  site: SiteData;
  /** Prefix for internal links: "/southside-cuts" in path mode, "" on the shop's own host. */
  base: string;
  /** Absolute canonical URL for a site path like "/barbers/marcus". */
  canonical: (path: string) => string;
  /** Booking link with optional preselection; always attributed to the website. */
  book: (params?: { service?: string | string[]; barber?: string }) => string;
  /** Dashboard preview: no caching, and links keep the preview query. */
  preview: boolean;
  /** Absolute URL of a site photo, or null. */
  media: (ref: MediaRef | null | undefined) => string | null;
};

/**
 * Loads the shop for a page and works out its URLs. Canonical URLs point at
 * the shop's custom domain when it has one, so search engines index one copy.
 */
export async function pageContext(
  slug: string | undefined,
  url: URL,
  hostMode: boolean,
): Promise<PageContext | null> {
  if (!slug) return null;
  const preview = url.searchParams.get("preview") === "1";
  const site = await siteBySlug(
    slug,
    preview ? { template: url.searchParams.get("template") } : undefined,
  );
  if (!site) return null;

  const base = hostMode ? "" : `/${site.shop.slug}`;
  const origin = site.shop.customDomain ? `https://${site.shop.customDomain}` : url.origin;
  const canonicalBase = site.shop.customDomain ? "" : base;

  return {
    site,
    base,
    canonical: (path) =>
      `${origin}${canonicalBase}${path === "/" ? (canonicalBase ? "" : "/") : path}`,
    book: (params = {}) => bookingLink(site.bookingUrl, params),
    preview,
    media: (ref) => mediaUrl(site.mediaBaseUrl, ref),
  };
}

/** "Oak Cliff, Dallas" / "Dallas, TX" / null: the place phrase for local SEO copy. */
export function placeName(site: SiteData): string | null {
  const city = site.shop.address?.city;
  if (site.shop.neighborhood && city) return `${site.shop.neighborhood}, ${city}`;
  if (city) return site.shop.address?.region ? `${city}, ${site.shop.address.region}` : city;
  return site.shop.neighborhood;
}

/**
 * Caching for shop pages. Vercel's CDN keeps them for a day, tagged with the
 * shop, and the database purges that tag the moment anything on the site
 * changes (see /api/revalidate), so visitors get cached speed and owners see
 * edits right away. Browsers always revalidate. Previews are never cached.
 */
export function setPageCache(headers: Headers, ctx: PageContext): void {
  if (ctx.preview) {
    headers.set("cache-control", "no-store");
    return;
  }
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("vercel-cdn-cache-control", "public, s-maxage=86400, stale-while-revalidate=604800");
  headers.set("vercel-cache-tag", shopCacheTag(ctx.site.shop.id));
}

/** The CDN cache tag for every page of one shop's site. */
export const shopCacheTag = (shopId: string) => `shop-${shopId}`;
