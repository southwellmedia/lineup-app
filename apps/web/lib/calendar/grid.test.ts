import { describe, expect, it } from "vitest";
import {
  dateRange,
  formatClockMinutes,
  instantAt,
  lanes,
  snap,
  visibleHours,
  wallMinutes,
  weekStart,
} from "./grid";

const TZ = "America/Chicago";

describe("weeks", () => {
  it("starts on Monday", () => {
    expect(weekStart("2026-09-24")).toBe("2026-09-21"); // Thursday
    expect(weekStart("2026-09-21")).toBe("2026-09-21");
    expect(weekStart("2026-09-27")).toBe("2026-09-21"); // Sunday
  });
  it("lists consecutive dates across a month end", () => {
    expect(dateRange("2026-09-29", 3)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
  });
});

describe("wall-clock positions", () => {
  it("places a UTC time on the local grid", () => {
    expect(wallMinutes("2026-09-24T15:30:00Z", "2026-09-24", TZ)).toBe(10 * 60 + 30);
  });
  it("keeps wall-clock hours on DST days", () => {
    // Spring forward: 2026-03-08. 10:00 CDT = 15:00Z.
    expect(wallMinutes("2026-03-08T15:00:00Z", "2026-03-08", TZ)).toBe(600);
    // Fall back: 2026-11-01. 10:00 CST = 16:00Z.
    expect(wallMinutes("2026-11-01T16:00:00Z", "2026-11-01", TZ)).toBe(600);
  });
  it("round-trips through instantAt", () => {
    const at = instantAt("2026-03-08", 600, TZ);
    expect(at.toISOString()).toBe("2026-03-08T15:00:00.000Z");
    expect(wallMinutes(at, "2026-03-08", TZ)).toBe(600);
  });
  it("counts past midnight for late bookings", () => {
    expect(wallMinutes("2026-09-25T05:30:00Z", "2026-09-24", TZ)).toBe(24 * 60 + 30);
  });
});

describe("grid helpers", () => {
  it("snaps down to the slot step", () => {
    expect(snap(607, 15)).toBe(600);
    expect(snap(615, 15)).toBe(615);
  });
  it("shows at least 9 to 5, widened to whole hours", () => {
    expect(visibleHours([])).toEqual({ start: 540, end: 1020 });
    expect(visibleHours([{ start: 8 * 60 + 30, end: 19 * 60 + 15 }])).toEqual({
      start: 480,
      end: 1200,
    });
  });
  it("formats clock labels", () => {
    expect(formatClockMinutes(0)).toBe("12 AM");
    expect(formatClockMinutes(12 * 60)).toBe("12 PM");
    expect(formatClockMinutes(14 * 60 + 30)).toBe("2:30 PM");
  });
});

describe("lanes", () => {
  it("keeps back-to-back blocks in one lane", () => {
    const out = lanes([
      { id: "a", start: 600, end: 630 },
      { id: "b", start: 630, end: 660 },
    ]);
    expect(out.map((b) => [b.id, b.lane, b.laneCount])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });
  it("splits overlapping blocks side by side", () => {
    const out = lanes([
      { id: "a", start: 600, end: 660 },
      { id: "b", start: 615, end: 645 },
      { id: "c", start: 700, end: 730 },
    ]);
    expect(out.map((b) => [b.id, b.lane, b.laneCount])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);
  });
});
