import type { DayHours } from "./hours";

/**
 * Everything a shop's website needs, as served by the platform's public
 * site API (`GET /api/public/sites/:slug`). Only public information.
 */
export type SiteData = {
  shop: {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    about: string | null;
    /** E.164, e.g. +12145550199. */
    phone: string | null;
    email: string | null;
    /** Handle without the @. */
    instagram: string | null;
    address: {
      line: string;
      city: string | null;
      region: string | null;
      postalCode: string | null;
    } | null;
    neighborhood: string | null;
    timezone: string;
    /** #RRGGBB, or null for the default. */
    brandColor: string | null;
    customDomain: string | null;
  };
  /** Absolute URL of the shop's booking flow, e.g. https://app.example.com/book/southside-cuts */
  bookingUrl: string;
  barbers: { id: string; slug: string; name: string; bio: string | null; serviceIds: string[] }[];
  services: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    /** Lowest and highest price across the barbers who offer it. */
    priceFromCents: number;
    priceToCents: number;
    isAddon: boolean;
    barberIds: string[];
  }[];
  hours: DayHours[];
  /** Third-party tags the owner added in Settings → Connections. Validated ids only. */
  tracking: {
    ga4MeasurementId: string | null;
    metaPixelId: string | null;
    googleSiteVerification: string | null;
  };
};
