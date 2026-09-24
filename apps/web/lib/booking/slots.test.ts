import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";
import {
  formatLongDate,
  formatTime,
  groupByDayPart,
  groupSlotsByDate,
  mergeSlots,
  nextDates,
  shopToday,
} from "./slots";

const TZ = "America/Chicago";

describe("slot helpers", () => {
  it("uses the shop's date, not UTC's", () => {
    // 03:00 UTC on the 30th is still the evening of the 29th in Dallas.
    expect(shopToday(TZ, new Date("2030-09-30T03:00:00Z"))).toBe("2030-09-29");
  });

  it("lists consecutive dates across a month end", () => {
    expect(nextDates("2030-09-29", 3)).toEqual(["2030-09-29", "2030-09-30", "2030-10-01"]);
  });

  it("groups slots by local date and time of day", () => {
    const slots = [
      "2030-09-30T02:00:00Z", // 21:00 on the 29th in Dallas
      "2030-09-29T15:00:00Z", // 10:00
      "2030-09-29T19:30:00Z", // 14:30
    ];
    const byDate = groupSlotsByDate(slots, TZ);
    expect([...byDate.keys()]).toEqual(["2030-09-29"]);

    const parts = groupByDayPart(byDate.get("2030-09-29") ?? [], TZ);
    expect(parts.map((p) => [p.part, p.slots.map((s) => formatTime(s, TZ))])).toEqual([
      ["Morning", ["10:00 AM"]],
      ["Afternoon", ["2:30 PM"]],
      ["Evening", ["9:00 PM"]],
    ]);
  });

  it("formats dates in the shop's timezone", () => {
    expect(formatLongDate("2030-09-30T02:00:00Z", TZ)).toBe("Sunday, September 29");
  });

  it("merges barbers' slots and remembers who is free", () => {
    const merged = mergeSlots([
      { staffId: "marcus", slots: ["2030-09-29T15:30:00Z", "2030-09-29T15:00:00Z"] },
      { staffId: "andre", slots: ["2030-09-29T15:00:00Z"] },
    ]);
    expect([...merged.entries()]).toEqual([
      ["2030-09-29T15:00:00Z", ["marcus", "andre"]],
      ["2030-09-29T15:30:00Z", ["marcus"]],
    ]);
  });
});

describe("buildIcs", () => {
  it("builds a valid event with escaped text", () => {
    const ics = buildIcs({
      uid: "abc",
      title: "Fade, beard trim",
      start: "2030-09-29T15:00:00.000Z",
      end: "2030-09-29T15:45:00Z",
      location: "Southside Cuts; Dallas",
    });
    expect(ics).toContain("DTSTART:20300929T150000Z");
    expect(ics).toContain("DTEND:20300929T154500Z");
    expect(ics).toContain("SUMMARY:Fade\\, beard trim");
    expect(ics).toContain("LOCATION:Southside Cuts\\; Dallas");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
