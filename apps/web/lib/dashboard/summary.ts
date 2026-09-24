export type AppointmentStatus =
  "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show" | "held" | "expired";

type Row = { status: AppointmentStatus; priceCents: number; paidCents: number; tipCents: number };

export type DaySummary = {
  /** Appointments still happening or done (not cancelled, not no-shows). */
  booked: number;
  /** What those appointments are worth. */
  expectedCents: number;
  /** Service money collected so far, net of refunds. Tips are separate. */
  collectedCents: number;
  tipsCents: number;
  noShows: number;
};

const LIVE: AppointmentStatus[] = ["confirmed", "checked_in", "completed"];

export function summarizeDay(rows: Row[]): DaySummary {
  return rows.reduce<DaySummary>(
    (sum, row) => ({
      booked: sum.booked + (LIVE.includes(row.status) ? 1 : 0),
      expectedCents: sum.expectedCents + (LIVE.includes(row.status) ? row.priceCents : 0),
      collectedCents: sum.collectedCents + row.paidCents,
      tipsCents: sum.tipsCents + row.tipCents,
      noShows: sum.noShows + (row.status === "no_show" ? 1 : 0),
    }),
    { booked: 0, expectedCents: 0, collectedCents: 0, tipsCents: 0, noShows: 0 },
  );
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  held: "Holding",
  confirmed: "Booked",
  checked_in: "In the chair",
  completed: "Done",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Expired",
};

const SOURCE_LABEL: Record<string, string> = {
  booking_link: "Booking link",
  website: "Website",
  instagram: "Instagram",
  google: "Google",
  phone: "Phone",
  walk_in: "Walk-in",
  referral: "Referral",
  import: "Imported",
  other: "Other",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

/** Formats an E.164 US number as (214) 555-0100; other countries stay as-is. */
export function formatPhone(e164: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : e164;
}
