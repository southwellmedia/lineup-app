import "server-only";
import type { Database } from "@lineup/db";
import { shopHours, slugify, type SiteData } from "@lineup/site-kit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrap } from "@/trpc/errors";

type Db = SupabaseClient<Database>;

const SHOP_COLUMNS =
  "id, name, slug, tagline, about, phone, email, instagram, address_line, city, region, postal_code, neighborhood, timezone, brand_color, custom_domain" as const;

/** Unique slugs for a list of names, in order: "Fade", "Fade" → "fade", "fade-2". */
function slugsFor(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}

/**
 * Loads a shop's public website data by booking slug or custom domain.
 * Returns null if there's no such shop. Uses the admin client, so it must
 * only ever select public fields.
 */
export async function loadSiteData(
  db: Db,
  lookup: { slug: string } | { domain: string },
  appOrigin: string,
): Promise<SiteData | null> {
  const query = db.from("shops").select(SHOP_COLUMNS);
  const shop = unwrap(
    await (
      "slug" in lookup
        ? query.eq("slug", lookup.slug)
        : query.eq("custom_domain", lookup.domain.toLowerCase())
    ).maybeSingle(),
  );
  if (!shop) return null;

  const [staff, services, offers, hours] = await Promise.all([
    db
      .from("staff")
      .select("id, slug, display_name, bio")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .eq("is_bookable", true)
      .order("sort_order"),
    db
      .from("services")
      .select("id, name, description, duration_minutes, price_cents, is_addon")
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    db.from("staff_services").select("staff_id, service_id, price_cents").eq("shop_id", shop.id),
    db
      .from("working_hours")
      .select("staff_id, weekday, start_time, end_time")
      .eq("shop_id", shop.id),
  ]);

  const barbers = unwrap(staff);
  const bookable = new Set(barbers.map((b) => b.id));
  const offerRows = unwrap(offers).filter((o) => bookable.has(o.staff_id));
  const serviceRows = unwrap(services);
  const serviceSlugs = slugsFor(serviceRows.map((s) => s.name));

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      tagline: shop.tagline,
      about: shop.about,
      phone: shop.phone,
      email: shop.email,
      instagram: shop.instagram,
      address: shop.address_line
        ? {
            line: shop.address_line,
            city: shop.city,
            region: shop.region,
            postalCode: shop.postal_code,
          }
        : null,
      neighborhood: shop.neighborhood,
      timezone: shop.timezone,
      brandColor: shop.brand_color,
      customDomain: shop.custom_domain,
    },
    bookingUrl: `${appOrigin}/book/${shop.slug}`,
    barbers: barbers.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.display_name,
      bio: b.bio,
      serviceIds: offerRows.filter((o) => o.staff_id === b.id).map((o) => o.service_id),
    })),
    services: serviceRows
      .map((s, i) => {
        const prices = offerRows
          .filter((o) => o.service_id === s.id)
          .map((o) => o.price_cents ?? s.price_cents);
        return {
          id: s.id,
          slug: serviceSlugs[i] ?? slugify(s.name),
          name: s.name,
          description: s.description,
          durationMinutes: s.duration_minutes,
          priceFromCents: prices.length ? Math.min(...prices) : s.price_cents,
          priceToCents: prices.length ? Math.max(...prices) : s.price_cents,
          isAddon: s.is_addon,
          barberIds: offerRows.filter((o) => o.service_id === s.id).map((o) => o.staff_id),
        };
      })
      // A service nobody bookable offers can't be booked, so it doesn't belong on the site.
      .filter((s) => s.barberIds.length > 0),
    hours: shopHours(
      unwrap(hours)
        .filter((h) => bookable.has(h.staff_id))
        .map((h) => ({ weekday: h.weekday, start: h.start_time, end: h.end_time })),
    ),
  };
}
