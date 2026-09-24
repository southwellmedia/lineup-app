import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { findAvailableSlots, isSlotAvailable, type AvailabilityInput } from "./availability";

const TZ = "America/Chicago";

/** A Dallas wall-clock time as an instant, e.g. local("2030-03-05 10:00"). */
function local(value: string): Date {
  const dt = DateTime.fromFormat(value, "yyyy-MM-dd HH:mm", { zone: TZ });
  if (!dt.isValid) throw new Error(`bad test time ${value}`);
  return dt.toJSDate();
}

/** Formats instants back to Dallas wall-clock "HH:mm" for readable assertions. */
function times(slots: Date[]): string[] {
  return slots.map((d) => DateTime.fromJSDate(d, { zone: TZ }).toFormat("HH:mm"));
}

const TUESDAY = "2030-03-05";

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timezone: TZ,
    from: local(`${TUESDAY} 00:00`),
    to: local("2030-03-06 00:00"),
    now: local("2030-03-01 12:00"),
    workingHours: [{ weekday: 2, start: "09:00", end: "11:00" }],
    timeOff: [],
    busy: [],
    durationMinutes: 30,
    bufferAfterMinutes: 0,
    slotIntervalMinutes: 30,
    minNoticeMinutes: 0,
    maxAdvanceDays: 60,
    ...overrides,
  };
}

describe("findAvailableSlots", () => {
  it("lists every start that fits inside working hours", () => {
    expect(times(findAvailableSlots(input()))).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("returns nothing on a day off", () => {
    const wednesday = input({ from: local("2030-03-06 00:00"), to: local("2030-03-07 00:00") });
    expect(findAvailableSlots(wednesday)).toEqual([]);
  });

  it("does not let a service run past closing", () => {
    expect(times(findAvailableSlots(input({ durationMinutes: 45 })))).toEqual([
      "09:00",
      "09:30",
      "10:00",
    ]);
  });

  it("lets the cleanup buffer run past closing", () => {
    expect(times(findAvailableSlots(input({ bufferAfterMinutes: 10 })))).toContain("10:30");
  });

  it("honors breaks expressed as split working hours", () => {
    const slots = findAvailableSlots(
      input({
        workingHours: [
          { weekday: 2, start: "09:00", end: "10:00" },
          { weekday: 2, start: "11:00", end: "12:00" },
        ],
      }),
    );
    expect(times(slots)).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });

  it("skips existing bookings and time off", () => {
    const slots = findAvailableSlots(
      input({
        workingHours: [{ weekday: 2, start: "09:00", end: "13:00" }],
        busy: [{ start: local(`${TUESDAY} 09:30`), end: local(`${TUESDAY} 10:00`) }],
        timeOff: [{ start: local(`${TUESDAY} 11:00`), end: local(`${TUESDAY} 12:00`) }],
      }),
    );
    expect(times(slots)).toEqual(["09:00", "10:00", "10:30", "12:00", "12:30"]);
  });

  it("keeps a new booking's buffer clear of the next appointment", () => {
    const slots = findAvailableSlots(
      input({
        bufferAfterMinutes: 5,
        busy: [{ start: local(`${TUESDAY} 10:00`), end: local(`${TUESDAY} 10:30`) }],
      }),
    );
    // 09:30 would be busy until 10:05, colliding with the 10:00 booking.
    expect(times(slots)).toEqual(["09:00", "10:30"]);
  });

  it("offers the moment a booking ends, so the chair can be filled back to back", () => {
    const slots = findAvailableSlots(
      input({
        workingHours: [{ weekday: 2, start: "09:00", end: "12:00" }],
        // A fade with a 5-minute buffer leaves the barber free at 09:35.
        busy: [{ start: local(`${TUESDAY} 09:00`), end: local(`${TUESDAY} 09:35`) }],
      }),
    );
    expect(times(slots)).toEqual(["09:35", "10:00", "10:30", "11:00", "11:30"]);
  });

  it("applies minimum notice and maximum advance booking", () => {
    const now = local(`${TUESDAY} 09:10`);
    expect(times(findAvailableSlots(input({ now, minNoticeMinutes: 60 })))).toEqual(["10:30"]);

    const tooFarAhead = input({ now: local("2029-12-01 12:00"), maxAdvanceDays: 30 });
    expect(findAvailableSlots(tooFarAhead)).toEqual([]);
  });

  it("never returns a slot in the past", () => {
    expect(times(findAvailableSlots(input({ now: local(`${TUESDAY} 10:00`) })))).toEqual([
      "10:00",
      "10:30",
    ]);
  });

  it("searches across several days", () => {
    const slots = findAvailableSlots(
      input({
        from: local("2030-03-04 00:00"), // Monday
        to: local("2030-03-11 00:00"),
        workingHours: [
          { weekday: 2, start: "09:00", end: "10:00" },
          { weekday: 6, start: "09:00", end: "10:00" },
        ],
      }),
    );
    expect(slots.map((d) => DateTime.fromJSDate(d, { zone: TZ }).toFormat("ccc HH:mm"))).toEqual([
      "Tue 09:00",
      "Tue 09:30",
      "Sat 09:00",
      "Sat 09:30",
    ]);
  });
});

describe("daylight saving time", () => {
  // In 2030, US clocks spring forward on Sunday March 10 and fall back on Sunday November 3.
  const sundayHours = [{ weekday: 0, start: "09:00", end: "10:00" }];

  it("keeps 9:00 at 9:00 local when clocks spring forward", () => {
    const before = findAvailableSlots(
      input({
        workingHours: [{ weekday: 0, start: "09:00", end: "10:00" }],
        from: local("2030-03-03 00:00"),
        to: local("2030-03-04 00:00"),
      }),
    );
    const after = findAvailableSlots(
      input({
        workingHours: sundayHours,
        from: local("2030-03-10 00:00"),
        to: local("2030-03-11 00:00"),
      }),
    );
    expect(before[0]?.toISOString()).toBe("2030-03-03T15:00:00.000Z"); // CST, UTC-6
    expect(after[0]?.toISOString()).toBe("2030-03-10T14:00:00.000Z"); // CDT, UTC-5
    expect(times(after)).toEqual(["09:00", "09:30"]);
  });

  it("keeps 9:00 at 9:00 local when clocks fall back", () => {
    const after = findAvailableSlots(
      input({
        workingHours: sundayHours,
        now: local("2030-10-01 12:00"),
        from: local("2030-11-03 00:00"),
        to: local("2030-11-04 00:00"),
      }),
    );
    expect(after[0]?.toISOString()).toBe("2030-11-03T15:00:00.000Z"); // back to CST
    expect(times(after)).toEqual(["09:00", "09:30"]);
  });

  it("uses real elapsed time for hours that span the change", () => {
    const overnight = [{ weekday: 0, start: "00:00", end: "04:00" }];
    const hourly = { durationMinutes: 60, slotIntervalMinutes: 60 };

    // Spring forward: 00:00-04:00 on the wall is only 3 real hours.
    const spring = findAvailableSlots(
      input({
        ...hourly,
        workingHours: overnight,
        from: local("2030-03-10 00:00"),
        to: local("2030-03-11 00:00"),
      }),
    );
    expect(spring).toHaveLength(3);
    expect(times(spring)).toEqual(["00:00", "01:00", "03:00"]);

    // Fall back: the same wall-clock hours are 5 real hours, and 01:00 happens twice.
    const fall = findAvailableSlots(
      input({
        ...hourly,
        workingHours: overnight,
        now: local("2030-10-01 12:00"),
        from: local("2030-11-03 00:00"),
        to: local("2030-11-04 00:00"),
      }),
    );
    expect(fall).toHaveLength(5);
    expect(times(fall)).toEqual(["00:00", "01:00", "01:00", "02:00", "03:00"]);
  });
});

describe("isSlotAvailable", () => {
  const base = input({
    busy: [{ start: local(`${TUESDAY} 10:00`), end: local(`${TUESDAY} 10:30`) }],
  });

  it("accepts an open time, even off the slot grid", () => {
    expect(isSlotAvailable(base, local(`${TUESDAY} 09:15`))).toBe(true);
  });

  it("rejects a time that overlaps a booking", () => {
    expect(isSlotAvailable(base, local(`${TUESDAY} 09:45`))).toBe(false);
  });

  it("rejects a time outside working hours or past closing", () => {
    expect(isSlotAvailable(base, local(`${TUESDAY} 08:30`))).toBe(false);
    expect(isSlotAvailable(base, local(`${TUESDAY} 10:45`))).toBe(false);
  });

  it("rejects a time inside the notice period", () => {
    const soon = { ...base, now: local(`${TUESDAY} 09:00`), minNoticeMinutes: 60 };
    expect(isSlotAvailable(soon, local(`${TUESDAY} 09:30`))).toBe(false);
    expect(isSlotAvailable(soon, local(`${TUESDAY} 10:30`))).toBe(true);
  });
});
