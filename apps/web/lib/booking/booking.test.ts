import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";
import { summarizeServices, type ServiceRow } from "./services";
import { localDaysWindow, parseTstzRange, toHourMinute } from "./time";

describe("normalizePhone", () => {
  it.each([
    ["(214) 555-0100", "+12145550100"],
    ["214.555.0100", "+12145550100"],
    ["1 214 555 0100", "+12145550100"],
    ["+52 55 1234 5678", "+525512345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["555-0100", "", "abc", "+0 123 456 789"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("summarizeServices", () => {
  const fade: ServiceRow = {
    id: "fade",
    duration_minutes: 30,
    buffer_after_minutes: 5,
    price_cents: 3500,
    deposit_cents: 1000,
    is_addon: false,
    is_active: true,
  };
  const beard: ServiceRow = {
    ...fade,
    id: "beard",
    duration_minutes: 15,
    buffer_after_minutes: 0,
    price_cents: 1500,
    deposit_cents: 0,
    is_addon: true,
  };
  const offered = [
    { service_id: "fade", price_cents: 4000, duration_minutes: null },
    { service_id: "beard", price_cents: null, duration_minutes: null },
  ];

  it("adds up services with the barber's overrides and the longest buffer", () => {
    expect(summarizeServices(["fade", "beard", "fade"], [fade, beard], offered)).toEqual({
      ok: true,
      summary: { durationMinutes: 45, bufferAfterMinutes: 5, priceCents: 5500, depositCents: 1000 },
    });
  });

  it("rejects add-ons on their own, unoffered or inactive services, and empty requests", () => {
    expect(summarizeServices(["beard"], [fade, beard], offered)).toEqual({
      ok: false,
      error: "addon_only",
    });
    expect(summarizeServices(["fade"], [fade], [])).toEqual({ ok: false, error: "not_offered" });
    expect(summarizeServices(["fade"], [{ ...fade, is_active: false }], offered)).toEqual({
      ok: false,
      error: "not_offered",
    });
    expect(summarizeServices([], [fade], offered)).toEqual({ ok: false, error: "empty" });
  });
});

describe("time helpers", () => {
  it("covers whole local days, including a daylight-saving change", () => {
    // Clocks spring forward in Dallas on 2030-03-10, so that day is 23 hours long.
    const window = localDaysWindow("2030-03-10", 1, "America/Chicago");
    expect(window.start.toISOString()).toBe("2030-03-10T06:00:00.000Z");
    expect(window.end.toISOString()).toBe("2030-03-11T05:00:00.000Z");
  });

  it("parses Postgres ranges as PostgREST returns them", () => {
    expect(parseTstzRange('["2030-01-01 10:00:00+00","2030-01-01 12:30:00+00")')).toEqual({
      start: new Date("2030-01-01T10:00:00Z"),
      end: new Date("2030-01-01T12:30:00Z"),
    });
    expect(parseTstzRange("empty")).toBeNull();
    expect(parseTstzRange(null)).toBeNull();
  });

  it("trims seconds off Postgres times", () => {
    expect(toHourMinute("09:30:00")).toBe("09:30");
  });
});
