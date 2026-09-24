import { describe, expect, it } from "vitest";
import { fillDays, rate, siteReport } from "./report";

describe("fillDays", () => {
  it("fills quiet days with zeros and merges bookings", () => {
    const points = fillDays(
      "2030-02-27",
      3,
      [{ day: "2030-02-28", visitors: 4, pageviews: 9, bookClicks: 2 }],
      new Map([["2030-03-01", 1]]),
    );
    expect(points).toEqual([
      { day: "2030-02-27", visitors: 0, bookClicks: 0, bookings: 0 },
      { day: "2030-02-28", visitors: 4, bookClicks: 2, bookings: 0 },
      { day: "2030-03-01", visitors: 0, bookClicks: 0, bookings: 1 },
    ]);
  });
});

describe("rate", () => {
  it("rounds to a whole percent and avoids dividing by zero", () => {
    expect(rate(1, 3)).toBe(33);
    expect(rate(0, 0)).toBeNull();
  });
});

describe("siteReport", () => {
  it("parses the database's JSON, including bigint counts sent as strings", () => {
    const parsed = siteReport.parse({
      totals: { pageviews: "4", visitors: 3, bookClicks: 1, bookingViewsFromSite: 0 },
      daily: [],
      pages: [{ path: "/", pageviews: 3 }],
      referrers: [{ referrer: null, visitors: 2 }],
      bookingSources: [],
    });
    expect(parsed.totals.pageviews).toBe(4);
  });
});
