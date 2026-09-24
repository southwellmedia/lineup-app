import { describe, expect, it } from "vitest";
import { brandInk, brandStyle, DEFAULT_BRAND } from "@lineup/site-kit";
import { SLUG_PATTERN, slugify, uniqueSlug } from "./slug";

describe("brand colors", () => {
  it("picks readable text for light and dark brands", () => {
    expect(brandInk("#FACC15")).toBe("#1c1714"); // yellow → dark text
    expect(brandInk("#1D4ED8")).toBe("#fdfbf7"); // blue → light text
  });

  it("falls back to the default brand for missing or bad values", () => {
    expect(brandStyle(null)["--brand"]).toBe(DEFAULT_BRAND);
    expect(brandStyle("red")["--brand"]).toBe(DEFAULT_BRAND);
    expect(brandStyle("#1D4ED8")).toMatchObject({
      "--brand": "#1D4ED8",
      "--color-brand": "#1D4ED8",
    });
  });
});

describe("slugs", () => {
  it("makes URL-safe slugs that pass the database rule", () => {
    expect(slugify("André's Cuts & Shaves")).toBe("andres-cuts-shaves");
    expect(slugify("  !!! ")).toBe("shop");
    for (const s of ["André's Cuts", "x".repeat(80), "Kings -- Barbers -"]) {
      expect(SLUG_PATTERN.test(slugify(s))).toBe(true);
    }
  });

  it("adds a number when a slug is taken", () => {
    expect(uniqueSlug("marcus", ["andre"])).toBe("marcus");
    expect(uniqueSlug("marcus", ["marcus", "marcus-2"])).toBe("marcus-3");
  });
});
