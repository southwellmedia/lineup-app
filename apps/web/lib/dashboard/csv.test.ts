import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines, and leaves numbers alone", () => {
    const csv = toCsv(
      ["Name", "Notes", "Visits"],
      [
        ["Jordan, Jr.", 'Says "low fade"\nno lineup', 4],
        ["Luis", null, 0],
      ],
    );
    expect(csv).toBe(
      '﻿Name,Notes,Visits\r\n"Jordan, Jr.","Says ""low fade""\nno lineup",4\r\nLuis,,0\r\n',
    );
  });

  it("neutralizes spreadsheet formulas but keeps phone numbers", () => {
    const csv = toCsv(["A", "B"], [['=HYPERLINK("x")', "+12145550100"]]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")",+12145550100`);
  });
});
