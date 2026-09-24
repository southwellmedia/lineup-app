export type MenuService = {
  id: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
  isAddon: boolean;
  offeredBy: { staffId: string; priceCents: number; durationMinutes: number }[];
};

export type Quote = { priceCents: number; durationMinutes: number; depositCents: number };

/**
 * What a set of services costs with one barber, using their own prices and
 * durations. Null when the barber doesn't offer all of them. Buffers aren't
 * included: clients never see cleanup time.
 */
export function quoteFor(
  services: MenuService[],
  serviceIds: string[],
  staffId: string,
): Quote | null {
  let quote: Quote = { priceCents: 0, durationMinutes: 0, depositCents: 0 };
  for (const id of serviceIds) {
    const service = services.find((s) => s.id === id);
    const offer = service?.offeredBy.find((o) => o.staffId === staffId);
    if (!service || !offer) return null;
    quote = {
      priceCents: quote.priceCents + offer.priceCents,
      durationMinutes: quote.durationMinutes + offer.durationMinutes,
      depositCents: quote.depositCents + service.depositCents,
    };
  }
  return quote;
}

/** Lowest and highest price for one service across the barbers who offer it. */
export function priceRange(service: MenuService): { low: number; high: number } {
  const prices = service.offeredBy.length
    ? service.offeredBy.map((o) => o.priceCents)
    : [service.priceCents];
  return { low: Math.min(...prices), high: Math.max(...prices) };
}
