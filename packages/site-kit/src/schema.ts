import { openingHoursSpecification } from "./hours";
import type { SiteData } from "./types";

/**
 * schema.org structured data for the shop's home page. Google uses this for
 * the business panel, hours and price range in local results. schema.org has
 * no BarberShop type; HairSalon is the closest official one.
 */
export function localBusinessJsonLd(site: SiteData, pageUrl: string) {
  const { shop } = site;
  const prices = site.services.filter((s) => !s.isAddon).map((s) => s.priceFromCents);
  const low = prices.length ? Math.min(...prices) / 100 : null;

  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": `${pageUrl}#business`,
    name: shop.name,
    url: pageUrl,
    ...(shop.about || shop.tagline ? { description: shop.about ?? shop.tagline } : {}),
    ...(shop.phone ? { telephone: shop.phone } : {}),
    ...(shop.email ? { email: shop.email } : {}),
    ...(shop.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: shop.address.line,
            ...(shop.address.city ? { addressLocality: shop.address.city } : {}),
            ...(shop.address.region ? { addressRegion: shop.address.region } : {}),
            ...(shop.address.postalCode ? { postalCode: shop.address.postalCode } : {}),
            addressCountry: "US",
          },
        }
      : {}),
    ...(shop.neighborhood ? { areaServed: shop.neighborhood } : {}),
    ...(low !== null ? { priceRange: `From $${low % 1 ? low.toFixed(2) : low}` } : {}),
    ...(shop.instagram ? { sameAs: [`https://www.instagram.com/${shop.instagram}/`] } : {}),
    openingHoursSpecification: openingHoursSpecification(site.hours),
    potentialAction: {
      "@type": "ReserveAction",
      target: { "@type": "EntryPoint", urlTemplate: site.bookingUrl },
      result: { "@type": "Reservation", name: "Appointment" },
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: site.services.map((s) => ({
        "@type": "Offer",
        price: (s.priceFromCents / 100).toFixed(2),
        priceCurrency: "USD",
        itemOffered: {
          "@type": "Service",
          name: s.name,
          ...(s.description ? { description: s.description } : {}),
        },
      })),
    },
  };
}

/** Safe to drop inside <script type="application/ld+json">: no closing tags can escape. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
