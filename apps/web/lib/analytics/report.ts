import { DateTime } from "luxon";
import { z } from "zod";

const count = z.coerce.number().int().nonnegative();

/** Shape of public.site_analytics() output. */
export const siteReport = z.object({
  totals: z.object({
    pageviews: count,
    visitors: count,
    bookClicks: count,
    bookingViewsFromSite: count,
  }),
  daily: z.array(
    z.object({ day: z.string(), visitors: count, pageviews: count, bookClicks: count }),
  ),
  pages: z.array(z.object({ path: z.string(), pageviews: count })),
  referrers: z.array(z.object({ referrer: z.string().nullable(), visitors: count })),
  bookingSources: z.array(z.object({ source: z.string().nullable(), visitors: count })),
});
export type SiteReport = z.infer<typeof siteReport>;

export type DayPoint = { day: string; visitors: number; bookClicks: number; bookings: number };

/**
 * One point per day from `from` for `days` days, with zeros where nothing
 * happened, so charts don't skip quiet days.
 */
export function fillDays(
  from: string,
  days: number,
  traffic: SiteReport["daily"],
  bookingsByDay: Map<string, number>,
): DayPoint[] {
  const start = DateTime.fromISO(from);
  return Array.from({ length: days }, (_, i) => {
    const day = start.plus({ days: i }).toISODate() ?? from;
    const t = traffic.find((d) => d.day === day);
    return {
      day,
      visitors: t?.visitors ?? 0,
      bookClicks: t?.bookClicks ?? 0,
      bookings: bookingsByDay.get(day) ?? 0,
    };
  });
}

/** Share as a whole percent, or null when there's nothing to divide by. */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}
