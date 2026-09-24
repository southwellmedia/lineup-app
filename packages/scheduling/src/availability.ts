import { DateTime } from "luxon";

/** A half-open time range [start, end). */
export type Interval = { start: Date; end: Date };

/** One block of weekly working hours in the shop's local time. */
export type WorkingHours = {
  /** 0 = Sunday ... 6 = Saturday, matching the database. */
  weekday: number;
  /** Local wall-clock time, "HH:MM". */
  start: string;
  end: string;
};

export type AvailabilityInput = {
  /** The shop's IANA timezone, e.g. "America/Chicago". */
  timezone: string;
  /** Search window. Slots starting in [from, to) are returned. */
  from: Date;
  to: Date;
  now: Date;

  workingHours: WorkingHours[];
  timeOff: Interval[];
  /** Existing live appointments and holds, as [starts_at, blocked_until). */
  busy: Interval[];

  /** How long the client is in the chair. Must fit inside working hours. */
  durationMinutes: number;
  /** Cleanup after the service. Blocks the calendar but may run past closing. */
  bufferAfterMinutes: number;

  slotIntervalMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
};

const MINUTE = 60_000;

function parseTime(value: string): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::00)?$/.exec(value);
  if (!match) throw new Error(`Invalid time "${value}", expected HH:MM`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function overlaps(aStart: number, aEnd: number, b: Interval): boolean {
  return aStart < b.end.getTime() && b.start.getTime() < aEnd;
}

/**
 * Turns weekly hours into concrete UTC windows for every local day that
 * touches [from, to). Wall-clock times are resolved in the shop's timezone,
 * so 9:00 stays 9:00 across daylight-saving changes.
 */
export function workingWindows(
  timezone: string,
  workingHours: WorkingHours[],
  from: Date,
  to: Date,
): Interval[] {
  const firstDay = DateTime.fromJSDate(from, { zone: timezone }).startOf("day").minus({ days: 1 });
  const lastDay = DateTime.fromJSDate(to, { zone: timezone }).startOf("day");
  if (!firstDay.isValid) throw new Error(`Invalid timezone "${timezone}"`);

  const windows: Interval[] = [];
  for (let day = firstDay; day <= lastDay; day = day.plus({ days: 1 })) {
    const weekday = day.weekday % 7; // Luxon: Monday = 1 ... Sunday = 7
    for (const hours of workingHours) {
      if (hours.weekday !== weekday) continue;
      const start = day.set({ ...parseTime(hours.start), second: 0, millisecond: 0 });
      const end = day.set({ ...parseTime(hours.end), second: 0, millisecond: 0 });
      if (end <= start) continue;
      windows.push({ start: start.toJSDate(), end: end.toJSDate() });
    }
  }
  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Every start time a client could book. Candidates are the regular grid
 * (every `slotIntervalMinutes` from the start of each working block) plus
 * the moment each existing booking or time-off ends, so the chair can be
 * filled back to back without awkward gaps.
 *
 * This is advisory: the database's exclusion constraint is what guarantees
 * no double-booking. The API should still re-check a requested slot with
 * `isSlotAvailable` so clients can't book outside working hours.
 */
export function findAvailableSlots(input: AvailabilityInput): Date[] {
  const {
    timezone,
    from,
    to,
    now,
    durationMinutes,
    bufferAfterMinutes,
    slotIntervalMinutes,
    minNoticeMinutes,
    maxAdvanceDays,
  } = input;

  if (durationMinutes <= 0) throw new Error("durationMinutes must be positive");
  if (slotIntervalMinutes <= 0) throw new Error("slotIntervalMinutes must be positive");

  const earliest = Math.max(from.getTime(), now.getTime() + minNoticeMinutes * MINUTE);
  const latest = Math.min(to.getTime(), now.getTime() + maxAdvanceDays * 24 * 60 * MINUTE);
  if (earliest >= latest) return [];

  const duration = durationMinutes * MINUTE;
  const occupied = (durationMinutes + bufferAfterMinutes) * MINUTE;
  const step = slotIntervalMinutes * MINUTE;
  const blocked = [...input.busy, ...input.timeOff];

  const slots = new Set<number>();
  for (const window of workingWindows(timezone, input.workingHours, from, to)) {
    const windowStart = window.start.getTime();
    const lastStart = window.end.getTime() - duration;

    const candidates: number[] = [];
    for (let t = windowStart; t <= lastStart; t += step) candidates.push(t);
    for (const b of blocked) {
      const end = b.end.getTime();
      if (end > windowStart && end <= lastStart) candidates.push(end);
    }

    for (const start of candidates) {
      if (start < earliest || start >= latest) continue;
      if (blocked.some((b) => overlaps(start, start + occupied, b))) continue;
      slots.add(start);
    }
  }

  return [...slots].sort((a, b) => a - b).map((t) => new Date(t));
}

/**
 * Whether one specific start time can be booked: inside working hours,
 * within notice and advance limits, and clear of other bookings and time off.
 * Doesn't require the time to sit on the slot grid, so staff (and the agents)
 * can book odd times like 10:35.
 */
export function isSlotAvailable(
  input: Omit<AvailabilityInput, "from" | "to">,
  start: Date,
): boolean {
  const duration = input.durationMinutes * MINUTE;
  const occupied = (input.durationMinutes + input.bufferAfterMinutes) * MINUTE;
  const t = start.getTime();

  if (t < input.now.getTime() + input.minNoticeMinutes * MINUTE) return false;
  if (t >= input.now.getTime() + input.maxAdvanceDays * 24 * 60 * MINUTE) return false;

  const inHours = workingWindows(input.timezone, input.workingHours, start, new Date(t + 1)).some(
    (w) => w.start.getTime() <= t && t + duration <= w.end.getTime(),
  );
  if (!inHours) return false;

  return ![...input.busy, ...input.timeOff].some((b) => overlaps(t, t + occupied, b));
}
