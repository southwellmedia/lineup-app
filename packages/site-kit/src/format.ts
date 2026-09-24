const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 3500 → "$35"; 3550 → "$35.50". Whole dollars drop the cents on menus. */
export function formatPrice(cents: number): string {
  return usd.format(cents / 100).replace(/\.00$/, "");
}

/** A price or range for a menu: "$35" or "$35–$40". */
export function formatPriceRange(from: number, to: number): string {
  return from === to ? formatPrice(from) : `${formatPrice(from)}–${formatPrice(to)}`;
}

/** +12145550100 → "(214) 555-0100"; other countries stay as-is. */
export function formatPhone(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}

/** "André's Cuts" → "andres-cuts". */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
  return slug || "item";
}

/** Appends booking deep-link parameters to the shop's booking URL. */
export function bookingLink(
  bookingUrl: string,
  params: { service?: string | string[]; barber?: string; src?: string } = {},
): string {
  const url = new URL(bookingUrl);
  url.searchParams.set("src", params.src ?? "website");
  // Several services (a main service plus add-ons) travel comma-separated.
  const service = Array.isArray(params.service) ? params.service.join(",") : params.service;
  if (service) url.searchParams.set("service", service);
  if (params.barber) url.searchParams.set("barber", params.barber);
  return url.toString();
}
