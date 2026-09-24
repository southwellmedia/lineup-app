import { describe, expect, it } from "vitest";
import { shopHours } from "./hours";
import { openStatus } from "./open-status";

// Tue & Wed 10:00–14:00 and 14:30–19:00; Sat 08:00–16:00. 2030-01-01 is a Tuesday.
const days = shopHours([
  { weekday: 2, start: "10:00", end: "14:00" },
  { weekday: 2, start: "14:30", end: "19:00" },
  { weekday: 3, start: "10:00", end: "19:00" },
  { weekday: 6, start: "08:00", end: "16:00" },
]);
const TZ = "America/Chicago"; // UTC-6 in January
const at = (utc: string) => new Date(utc);

describe("openStatus", () => {
  it("is open during a block", () => {
    expect(openStatus(days, TZ, at("2030-01-01T17:00:00Z"))).toEqual({
      open: true,
      text: "Open now · until 2 PM",
    });
  });

  it("shows the next opening during a break or before opening", () => {
    expect(openStatus(days, TZ, at("2030-01-01T20:10:00Z")).text).toBe("Opens at 2:30 PM");
    expect(openStatus(days, TZ, at("2030-01-01T14:00:00Z")).text).toBe("Opens at 10 AM");
  });

  it("looks ahead to the next open day", () => {
    expect(openStatus(days, TZ, at("2030-01-02T02:00:00Z")).text).toBe(
      "Closed · opens tomorrow 10 AM",
    ); // Tue 8 PM
    expect(openStatus(days, TZ, at("2030-01-03T02:00:00Z")).text).toBe("Closed · opens Sat 8 AM"); // Wed 8 PM
  });

  it("uses the shop's timezone, not the visitor's", () => {
    // 15:30 UTC is 9:30 in Dallas: not open yet.
    expect(openStatus(days, TZ, at("2030-01-01T15:30:00Z")).open).toBe(false);
  });

  it("handles a shop with no hours", () => {
    expect(openStatus(shopHours([]), TZ, new Date())).toEqual({ open: false, text: "Closed" });
  });
});
