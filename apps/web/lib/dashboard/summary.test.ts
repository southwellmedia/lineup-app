import { describe, expect, it } from "vitest";
import { formatPhone, summarizeDay } from "./summary";

describe("summarizeDay", () => {
  it("counts live appointments, money collected and no-shows", () => {
    expect(
      summarizeDay([
        { status: "completed", priceCents: 3500, paidCents: 3500, tipCents: 500 },
        { status: "confirmed", priceCents: 5500, paidCents: 0, tipCents: 0 },
        { status: "checked_in", priceCents: 3000, paidCents: 1000, tipCents: 0 },
        { status: "cancelled", priceCents: 2500, paidCents: 0, tipCents: 0 },
        { status: "no_show", priceCents: 3500, paidCents: 0, tipCents: 0 },
      ]),
    ).toEqual({
      booked: 3,
      expectedCents: 12000,
      collectedCents: 4500,
      tipsCents: 500,
      noShows: 1,
    });
  });

  it("is all zeros for an empty day", () => {
    expect(summarizeDay([])).toEqual({
      booked: 0,
      expectedCents: 0,
      collectedCents: 0,
      tipsCents: 0,
      noShows: 0,
    });
  });
});

describe("formatPhone", () => {
  it("formats US numbers and leaves others alone", () => {
    expect(formatPhone("+12145550100")).toBe("(214) 555-0100");
    expect(formatPhone("+525512345678")).toBe("+525512345678");
  });
});
