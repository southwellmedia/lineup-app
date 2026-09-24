import { describe, expect, it } from "vitest";
import { formatHour, hoursTable, openingHoursSpecification, shopHours } from "./hours";

describe("shopHours", () => {
  it("merges barbers' blocks per day, keeping real gaps", () => {
    const days = shopHours([
      { weekday: 2, start: "10:00:00", end: "14:00:00" },
      { weekday: 2, start: "14:30:00", end: "19:00:00" },
      { weekday: 2, start: "09:00:00", end: "12:00:00" }, // another barber starts earlier
      { weekday: 2, start: "13:30:00", end: "15:00:00" }, // covers the first barber's lunch
      { weekday: 6, start: "08:00:00", end: "16:00:00" },
    ]);
    expect(days[2]?.open).toEqual([{ start: "09:00", end: "19:00" }]);
    expect(days[6]?.open).toEqual([{ start: "08:00", end: "16:00" }]);
    expect(days[0]?.open).toEqual([]);
  });

  it("keeps a lunch break when everyone takes it", () => {
    const days = shopHours([
      { weekday: 3, start: "10:00", end: "14:00" },
      { weekday: 3, start: "14:30", end: "19:00" },
    ]);
    expect(days[3]?.open).toEqual([
      { start: "10:00", end: "14:00" },
      { start: "14:30", end: "19:00" },
    ]);
  });
});

describe("display", () => {
  it("formats hours for people and for search engines", () => {
    expect(formatHour("10:00")).toBe("10 AM");
    expect(formatHour("14:30")).toBe("2:30 PM");
    expect(formatHour("00:00")).toBe("12 AM");
    expect(formatHour("12:00")).toBe("12 PM");

    const days = shopHours([{ weekday: 1, start: "10:00", end: "19:00" }]);
    expect(hoursTable(days)[0]).toEqual({ day: "Monday", text: "10 AM – 7 PM" });
    expect(hoursTable(days)[6]).toEqual({ day: "Sunday", text: "Closed" });
    expect(openingHoursSpecification(days)).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "https://schema.org/Monday",
        opens: "10:00",
        closes: "19:00",
      },
    ]);
  });
});
