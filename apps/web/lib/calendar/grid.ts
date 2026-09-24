import { DateTime } from "luxon";

/** The Monday on or before `date` (YYYY-MM-DD). Weeks run Monday to Sunday. */
export function weekStart(date: string): string {
  const day = DateTime.fromISO(date);
  return day.minus({ days: day.weekday - 1 }).toISODate() ?? date;
}

/** `count` consecutive dates starting at `start`. */
export function dateRange(start: string, count: number): string[] {
  const first = DateTime.fromISO(start);
  return Array.from({ length: count }, (_, i) => first.plus({ days: i }).toISODate() ?? start);
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date).plus({ days }).toISODate() ?? date;
}

/** Today's date in the shop's timezone. */
export function todayIn(timezone: string, now = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timezone }).toISODate() ?? "";
}

/**
 * Wall-clock minutes from local midnight of `date` to `at`, in the shop's
 * timezone. The grid draws wall-clock hours, so 10:00 AM sits at 600 even on
 * a DST day. Times on later days keep counting (a 12:30 AM finish is 1470).
 */
export function wallMinutes(at: string | Date, date: string, timezone: string): number {
  const time =
    typeof at === "string"
      ? DateTime.fromISO(at, { zone: timezone })
      : DateTime.fromJSDate(at, { zone: timezone });
  const midnight = DateTime.fromISO(date, { zone: timezone }).startOf("day");
  const days = Math.round(time.startOf("day").diff(midnight, "days").days);
  return days * 24 * 60 + time.hour * 60 + time.minute;
}

/** The UTC instant for a wall-clock minute of `date` in the shop's timezone. */
export function instantAt(date: string, minutes: number, timezone: string): Date {
  return DateTime.fromISO(date, { zone: timezone })
    .startOf("day")
    .set({ hour: Math.floor(minutes / 60), minute: minutes % 60 })
    .toJSDate();
}

/** Rounds `minutes` down to the slot grid. */
export function snap(minutes: number, step: number): number {
  return Math.floor(minutes / step) * step;
}

/**
 * The hours to draw: from the earliest working hour or booking to the
 * latest, padded to whole hours, never narrower than 9 to 5.
 */
export function visibleHours(ranges: { start: number; end: number }[]): {
  start: number;
  end: number;
} {
  let start = 9 * 60;
  let end = 17 * 60;
  for (const r of ranges) {
    start = Math.min(start, r.start);
    end = Math.max(end, r.end);
  }
  return {
    start: Math.max(0, Math.floor(start / 60) * 60),
    end: Math.min(24 * 60, Math.ceil(end / 60) * 60),
  };
}

/**
 * Side-by-side lanes for blocks that overlap within one column (only
 * possible with no-shows, which don't hold the chair). Returns each block's
 * lane and the lane count of its overlap group.
 */
export function lanes<T extends { start: number; end: number }>(
  blocks: T[],
): (T & { lane: number; laneCount: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { lane: number; laneCount: number })[] = [];
  let group: (T & { lane: number; laneCount: number })[] = [];
  let groupEnd = -Infinity;

  const flush = () => {
    const count = Math.max(1, ...group.map((b) => b.lane + 1));
    for (const b of group) b.laneCount = count;
    out.push(...group);
    group = [];
  };

  for (const block of sorted) {
    if (block.start >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    const busy = new Set(group.filter((b) => b.end > block.start).map((b) => b.lane));
    let lane = 0;
    while (busy.has(lane)) lane += 1;
    group.push({ ...block, lane, laneCount: 1 });
    groupEnd = Math.max(groupEnd, block.end);
  }
  flush();
  return out;
}

/** "9 AM", "12 PM", "2:30 PM". */
export function formatClockMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}
