import { describe, expect, it } from "vitest";
import { chairTime, formatClock } from "./chair";

const appt = {
  startsAt: "2030-01-01T16:00:00Z",
  endsAt: "2030-01-01T16:45:00Z",
  checkedInAt: "2030-01-01T16:05:00Z",
};
const at = (iso: string) => new Date(iso).getTime();

describe("chairTime", () => {
  it("counts from check-in against the booked length", () => {
    expect(chairTime(appt, at("2030-01-01T16:20:00Z"))).toEqual({
      elapsed: 900,
      planned: 2700,
      progress: 1 / 3,
      over: 0,
    });
  });

  it("reports time over the booked length", () => {
    const t = chairTime(appt, at("2030-01-01T16:55:30Z"));
    expect(t.progress).toBe(1);
    expect(t.over).toBe(330);
  });

  it("falls back to the booking start without a check-in time, and never goes negative", () => {
    expect(chairTime({ ...appt, checkedInAt: null }, at("2030-01-01T16:10:00Z")).elapsed).toBe(600);
    expect(chairTime(appt, at("2030-01-01T16:00:00Z")).elapsed).toBe(0);
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [754, "12:34"],
    [3754, "1:02:34"],
  ])("%i → %s", (s, out) => {
    expect(formatClock(s)).toBe(out);
  });
});
