import { DateTime } from "luxon";

export type DayPart = "Morning" | "Afternoon" | "Evening";

export type DaySlots = {
  /** Local date, YYYY-MM-DD. */
  date: string;
  slots: string[];
};

/** Today in the shop's timezone, as YYYY-MM-DD. */
export function shopToday(timezone: string, now = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timezone }).toISODate() ?? "";
}

/** `count` consecutive local dates starting at `start`. */
export function nextDates(start: string, count: number): string[] {
  const first = DateTime.fromISO(start);
  return Array.from({ length: count }, (_, i) => first.plus({ days: i }).toISODate() ?? "");
}

/** Buckets ISO slot instants by their local date in the shop's timezone. */
export function groupSlotsByDate(slots: string[], timezone: string): Map<string, string[]> {
  const byDate = new Map<string, string[]>();
  for (const slot of slots) {
    const date = DateTime.fromISO(slot, { zone: timezone }).toISODate();
    if (!date) continue;
    const list = byDate.get(date) ?? [];
    list.push(slot);
    byDate.set(date, list);
  }
  for (const list of byDate.values()) list.sort();
  return byDate;
}

export function dayPart(slot: string, timezone: string): DayPart {
  const hour = DateTime.fromISO(slot, { zone: timezone }).hour;
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

/** Splits one day's slots into Morning / Afternoon / Evening, skipping empty parts. */
export function groupByDayPart(
  slots: string[],
  timezone: string,
): { part: DayPart; slots: string[] }[] {
  const parts: DayPart[] = ["Morning", "Afternoon", "Evening"];
  return parts
    .map((part) => ({ part, slots: slots.filter((s) => dayPart(s, timezone) === part) }))
    .filter((group) => group.slots.length > 0);
}

/** "2:30 PM" in the shop's timezone, whatever the viewer's device says. */
export function formatTime(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone }).toFormat("h:mm a");
}

/** "Tuesday, September 29" in the shop's timezone. */
export function formatLongDate(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: timezone }).toFormat("cccc, LLLL d");
}

/** Merges several barbers' slots, remembering which barbers are free at each time. */
export function mergeSlots(
  byBarber: { staffId: string; slots: string[] }[],
): Map<string, string[]> {
  const merged = new Map<string, string[]>();
  for (const { staffId, slots } of byBarber) {
    for (const slot of slots) merged.set(slot, [...(merged.get(slot) ?? []), staffId]);
  }
  return new Map([...merged.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
