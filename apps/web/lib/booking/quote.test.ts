import { describe, expect, it } from "vitest";
import { priceRange, quoteFor, type MenuService } from "./quote";

const fade: MenuService = {
  id: "fade",
  durationMinutes: 30,
  priceCents: 3500,
  depositCents: 1000,
  isAddon: false,
  offeredBy: [
    { staffId: "marcus", priceCents: 4000, durationMinutes: 30 },
    { staffId: "andre", priceCents: 3500, durationMinutes: 30 },
  ],
};
const beard: MenuService = {
  id: "beard",
  durationMinutes: 15,
  priceCents: 1500,
  depositCents: 0,
  isAddon: true,
  offeredBy: [{ staffId: "marcus", priceCents: 1500, durationMinutes: 15 }],
};

describe("quoteFor", () => {
  it("totals a barber's own prices and durations", () => {
    expect(quoteFor([fade, beard], ["fade", "beard"], "marcus")).toEqual({
      priceCents: 5500,
      durationMinutes: 45,
      depositCents: 1000,
    });
  });

  it("returns null when the barber doesn't offer every service", () => {
    expect(quoteFor([fade, beard], ["fade", "beard"], "andre")).toBeNull();
  });
});

describe("priceRange", () => {
  it("spans the barbers' prices", () => {
    expect(priceRange(fade)).toEqual({ low: 3500, high: 4000 });
    expect(priceRange({ ...fade, offeredBy: [] })).toEqual({ low: 3500, high: 3500 });
  });
});
