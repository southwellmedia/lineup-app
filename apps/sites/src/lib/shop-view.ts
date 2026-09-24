import type { SiteData } from "@lineup/site-kit";

/** Google Maps search for the shop, or null without an address. */
export function mapsUrl(site: SiteData): string | null {
  const a = site.shop.address;
  if (!a) return null;
  const query = [site.shop.name, a.line, a.city, a.region].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** The section settings of one type, if that section is switched on. */
export function enabledSection<T extends SiteData["design"]["sections"][number]["type"]>(
  site: SiteData,
  type: T,
): Extract<SiteData["design"]["sections"][number], { type: T }> | null {
  const section = site.design.sections.find((s) => s.type === type);
  return section?.enabled
    ? (section as Extract<SiteData["design"]["sections"][number], { type: T }>)
    : null;
}
