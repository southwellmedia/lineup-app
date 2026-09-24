import type { SiteData } from "@lineup/site-kit";
import { describe, expect, it } from "vitest";
import { shopSiteUrl, siteChecklist } from "./overview";

const site: SiteData = {
  shop: {
    id: "s1",
    name: "Southside Cuts",
    slug: "southside-cuts",
    tagline: "Sharp fades.",
    about: null,
    phone: "+12145550199",
    email: null,
    instagram: null,
    address: { line: "123 W Davis St", city: "Dallas", region: "TX", postalCode: "75208" },
    neighborhood: null,
    timezone: "America/Chicago",
    brandColor: null,
    customDomain: null,
  },
  bookingUrl: "https://app.test/book/southside-cuts",
  barbers: [
    { id: "b1", slug: "marcus", name: "Marcus", bio: "Owner.", serviceIds: ["v1"] },
    { id: "b2", slug: "andrea", name: "Andrea", bio: null, serviceIds: ["v1"] },
  ],
  services: [
    {
      id: "v1",
      slug: "fade",
      name: "Fade",
      description: null,
      durationMinutes: 30,
      priceFromCents: 3500,
      priceToCents: 3500,
      isAddon: false,
      barberIds: ["b1", "b2"],
    },
    {
      id: "v2",
      slug: "beard",
      name: "Beard",
      description: null,
      durationMinutes: 15,
      priceFromCents: 1500,
      priceToCents: 1500,
      isAddon: true,
      barberIds: ["b1"],
    },
  ],
  hours: [],
  tracking: { ga4MeasurementId: null, metaPixelId: null, googleSiteVerification: null },
};

describe("shopSiteUrl", () => {
  it("uses the sites host and slug", () => {
    expect(shopSiteUrl({ slug: "a", customDomain: null }, "https://sites.test/")).toBe(
      "https://sites.test/a",
    );
  });
  it("prefers a custom domain", () => {
    expect(shopSiteUrl({ slug: "a", customDomain: "a.com" }, "https://sites.test")).toBe(
      "https://a.com",
    );
  });
  it("is null when nothing is configured", () => {
    expect(shopSiteUrl({ slug: "a", customDomain: null }, null)).toBeNull();
  });
});

describe("siteChecklist", () => {
  const byId = Object.fromEntries(siteChecklist(site).map((i) => [i.id, i]));
  it("marks filled fields done", () => {
    expect(byId.tagline?.done).toBe(true);
    expect(byId.address?.done).toBe(true);
    expect(byId.about?.done).toBe(false);
  });
  it("names barbers without a bio", () => {
    expect(byId.barbers).toMatchObject({ done: false, detail: "Missing: Andrea" });
  });
  it("ignores add-ons when counting missing descriptions", () => {
    expect(byId.services).toMatchObject({ done: false, detail: "1 service without one" });
  });
});
