import { createHash } from "node:crypto";

/**
 * Anonymous visitor id for one shop and one UTC day. The salt is secret and
 * the day is part of the input, so the same person gets a new id every day
 * and nobody can reverse it to an IP address. Nothing is stored in the browser.
 */
export function visitorHash(args: {
  salt: string;
  day: string;
  shopId: string;
  ip: string;
  userAgent: string;
}): string {
  return createHash("sha256")
    .update([args.salt, args.day, args.shopId, args.ip, args.userAgent].join("|"))
    .digest("hex")
    .slice(0, 32);
}

const BOT =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python|go-http/i;

/** Crawlers, link previews and uptime checks shouldn't count as visits. */
export function isBot(userAgent: string): boolean {
  return !userAgent || BOT.test(userAgent);
}

export function deviceOf(userAgent: string): "mobile" | "desktop" {
  return /mobi|android|iphone|ipad/i.test(userAgent) ? "mobile" : "desktop";
}

/** Big platforms reach us from many hosts (l.instagram.com, google.co.uk...). */
const CHANNELS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$|^ig$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$|^fb$/, "facebook"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/^(t\.co|x\.com|twitter\.com)$/, "x"],
  [/(^|\.)yelp\.[a-z.]+$/, "yelp"],
  [/(^|\.)bing\.com$/, "bing"],
];

function channel(value: string): string {
  return CHANNELS.find(([pattern]) => pattern.test(value))?.[1] ?? value;
}

/**
 * Where a visit came from: utm_source if the link had one, otherwise the
 * referring site's host (without "www."), with the big platforms folded into
 * one name each. Null for direct visits and for clicks within the site itself.
 */
export function referrerOf(
  referrer: string | undefined,
  utmSource: string | undefined,
  ownHosts: string[],
): string | null {
  const utm = utmSource?.trim().toLowerCase().slice(0, 60);
  if (utm) return channel(utm);
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || ownHosts.some((h) => h.replace(/^www\./, "") === host)) return null;
    return channel(host).slice(0, 200);
  } catch {
    return null;
  }
}

/**
 * The page's path within the shop's site, the same whether it was served
 * at /<slug>/... or on the shop's own domain.
 */
export function sitePath(path: string, slug: string): string {
  const clean = (path.split(/[?#]/)[0] ?? "/").replace(/\/+$/, "") || "/";
  const prefix = `/${slug}`;
  const inner =
    clean === prefix ? "/" : clean.startsWith(`${prefix}/`) ? clean.slice(prefix.length) : clean;
  return inner.slice(0, 300);
}

/** First address in X-Forwarded-For, or the header as given. */
export function clientIp(forwardedFor: string | null): string {
  return forwardedFor?.split(",")[0]?.trim() ?? "";
}
