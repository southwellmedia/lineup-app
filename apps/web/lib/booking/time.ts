import type { Interval } from "@lineup/scheduling";
import { DateTime } from "luxon";

/**
 * The UTC window covering `days` whole local days starting on `date`
 * (YYYY-MM-DD) in the shop's timezone.
 */
export function localDaysWindow(date: string, days: number, timezone: string): Interval {
  const start = DateTime.fromISO(date, { zone: timezone }).startOf("day");
  if (!start.isValid) throw new Error(`Invalid date "${date}" or timezone "${timezone}"`);
  return { start: start.toJSDate(), end: start.plus({ days }).toJSDate() };
}

/**
 * Parses a Postgres tstzrange as returned by PostgREST, e.g.
 * `["2030-01-01 10:00:00+00","2030-01-01 12:00:00+00")`. Bounds are treated
 * as half-open, which is how time off is stored.
 */
export function parseTstzRange(value: unknown): Interval | null {
  if (typeof value !== "string") return null;
  const match = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const start = parsePgTimestamp(match[1]);
  const end = parsePgTimestamp(match[2]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

/** Postgres writes offsets as "+00" or "-05"; JS Date needs "+00:00". */
function parsePgTimestamp(value: string): Date {
  return new Date(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
}

/** "HH:MM:SS" from Postgres `time` → "HH:MM" for the scheduling engine. */
export function toHourMinute(value: string): string {
  return value.slice(0, 5);
}
