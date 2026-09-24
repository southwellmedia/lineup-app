import type { SiteData } from "@lineup/site-kit";

/** The shop's public website address, or null if no sites host is configured. */
export function shopSiteUrl(
  shop: { slug: string; customDomain: string | null },
  sitesUrl: string | null,
): string | null {
  if (shop.customDomain) return `https://${shop.customDomain}`;
  if (!sitesUrl) return null;
  return `${sitesUrl.replace(/\/+$/, "")}/${shop.slug}`;
}

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  /** Short note on what's missing, when not done. */
  detail?: string;
  /** Dashboard section where it's fixed. */
  section: "settings" | "team" | "services";
};

/** What a shop's website still needs, in the order a visitor would notice it. */
export function siteChecklist(site: SiteData): ChecklistItem[] {
  const { shop, barbers, services } = site;
  const noBio = barbers.filter((b) => !b.bio).map((b) => b.name);
  const noDescription = services.filter((s) => !s.isAddon && !s.description).length;
  return [
    { id: "tagline", label: "Tagline", done: Boolean(shop.tagline), section: "settings" },
    { id: "about", label: "About the shop", done: Boolean(shop.about), section: "settings" },
    { id: "phone", label: "Phone number", done: Boolean(shop.phone), section: "settings" },
    { id: "address", label: "Address", done: Boolean(shop.address), section: "settings" },
    { id: "instagram", label: "Instagram", done: Boolean(shop.instagram), section: "settings" },
    {
      id: "barbers",
      label: "Barber bios",
      done: barbers.length > 0 && noBio.length === 0,
      detail: barbers.length === 0 ? "No bookable barbers" : `Missing: ${noBio.join(", ")}`,
      section: "team",
    },
    {
      id: "services",
      label: "Service descriptions",
      done: services.length > 0 && noDescription === 0,
      detail:
        services.length === 0
          ? "No services offered"
          : `${noDescription} service${noDescription === 1 ? "" : "s"} without one`,
      section: "services",
    },
  ];
}
