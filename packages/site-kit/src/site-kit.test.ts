import { describe, expect, it } from "vitest";
import {
  bookingLink,
  formatPrice,
  formatPriceRange,
  jsonLdScript,
  localBusinessJsonLd,
  shopHours,
  type SiteData,
} from "./index";

const site: SiteData = {
  shop: {
    id: "shop",
    name: "Southside Cuts",
    slug: "southside-cuts",
    tagline: "Sharp fades.",
    about: null,
    phone: "+12145550199",
    email: null,
    instagram: "southsidecuts",
    address: { line: "123 W Davis St", city: "Dallas", region: "TX", postalCode: "75208" },
    neighborhood: "Oak Cliff",
    timezone: "America/Chicago",
    brandColor: null,
    customDomain: null,
  },
  bookingUrl: "https://app.example.com/book/southside-cuts",
  barbers: [],
  services: [
    {
      id: "fade",
      slug: "fade",
      name: "Fade",
      description: null,
      durationMinutes: 30,
      priceFromCents: 3500,
      priceToCents: 4000,
      isAddon: false,
      barberIds: [],
    },
    {
      id: "beard",
      slug: "beard",
      name: "Beard",
      description: null,
      durationMinutes: 15,
      priceFromCents: 1500,
      priceToCents: 1500,
      isAddon: true,
      barberIds: [],
    },
  ],
  hours: shopHours([{ weekday: 2, start: "10:00", end: "19:00" }]),
  tracking: { ga4MeasurementId: null, metaPixelId: null, googleSiteVerification: null },
};

describe("prices", () => {
  it("drops .00 and shows ranges", () => {
    expect(formatPrice(3500)).toBe("$35");
    expect(formatPrice(3550)).toBe("$35.50");
    expect(formatPriceRange(3500, 4000)).toBe("$35–$40");
    expect(formatPriceRange(2500, 2500)).toBe("$25");
  });
});

describe("bookingLink", () => {
  it("adds attribution and optional preselection", () => {
    expect(bookingLink(site.bookingUrl)).toBe(
      "https://app.example.com/book/southside-cuts?src=website",
    );
    expect(bookingLink(site.bookingUrl, { service: "fade", barber: "m" })).toBe(
      "https://app.example.com/book/southside-cuts?src=website&service=fade&barber=m",
    );
  });
});

describe("localBusinessJsonLd", () => {
  it("describes the business for search engines", () => {
    const ld = localBusinessJsonLd(site, "https://southsidecuts.com/");
    expect(ld).toMatchObject({
      "@type": "HairSalon",
      name: "Southside Cuts",
      telephone: "+12145550199",
      priceRange: "From $35",
      areaServed: "Oak Cliff",
      address: { streetAddress: "123 W Davis St", addressLocality: "Dallas", postalCode: "75208" },
      sameAs: ["https://www.instagram.com/southsidecuts/"],
    });
    expect(ld.openingHoursSpecification).toHaveLength(1);
    expect(ld.hasOfferCatalog.itemListElement).toHaveLength(2);
  });

  it("can't break out of its script tag", () => {
    expect(jsonLdScript({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
