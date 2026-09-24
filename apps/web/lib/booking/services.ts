export type ServiceRow = {
  id: string;
  duration_minutes: number;
  buffer_after_minutes: number;
  price_cents: number;
  deposit_cents: number;
  is_addon: boolean;
  is_active: boolean;
};

export type StaffServiceRow = {
  service_id: string;
  price_cents: number | null;
  duration_minutes: number | null;
};

export type ServiceSummary = {
  durationMinutes: number;
  bufferAfterMinutes: number;
  priceCents: number;
  depositCents: number;
};

export type ServiceSummaryError = "not_offered" | "addon_only" | "empty";

/**
 * Totals a booking the same way `create_appointment` does in the database:
 * durations and prices add up (with the barber's overrides), the longest
 * cleanup buffer applies once, and at least one main service is required.
 */
export function summarizeServices(
  requestedIds: string[],
  services: ServiceRow[],
  staffServices: StaffServiceRow[],
): { ok: true; summary: ServiceSummary } | { ok: false; error: ServiceSummaryError } {
  const ids = [...new Set(requestedIds)];
  if (ids.length === 0) return { ok: false, error: "empty" };

  const summary: ServiceSummary = {
    durationMinutes: 0,
    bufferAfterMinutes: 0,
    priceCents: 0,
    depositCents: 0,
  };
  let hasMain = false;

  for (const id of ids) {
    const service = services.find((s) => s.id === id && s.is_active);
    const offered = staffServices.find((ss) => ss.service_id === id);
    if (!service || !offered) return { ok: false, error: "not_offered" };

    summary.durationMinutes += offered.duration_minutes ?? service.duration_minutes;
    summary.priceCents += offered.price_cents ?? service.price_cents;
    summary.depositCents += service.deposit_cents;
    summary.bufferAfterMinutes = Math.max(summary.bufferAfterMinutes, service.buffer_after_minutes);
    if (!service.is_addon) hasMain = true;
  }

  return hasMain ? { ok: true, summary } : { ok: false, error: "addon_only" };
}
