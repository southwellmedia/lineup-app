import { describe, expect, it } from "vitest";
import { canShare, shareCaption } from "./caption";

const base = {
  services: ["Fade", "Beard Trim"],
  barberName: "Andrea",
  shopInstagram: "southsidecuts",
  shopName: "Southside Cuts",
  clientInstagram: "jordan.e",
  bookingUrl: "https://app.test/book/southside-cuts?src=instagram",
};

describe("shareCaption", () => {
  it("tags the client only with social consent", () => {
    expect(shareCaption({ ...base, consent: "social" })).toBe(
      "Fade + Beard Trim by Andrea ✂️\nOn @jordan.e\n@southsidecuts\nBook: https://app.test/book/southside-cuts?src=instagram",
    );
    expect(shareCaption({ ...base, consent: "portfolio" })).not.toContain("jordan.e");
  });
  it("prefers the barber's own caption", () => {
    expect(
      shareCaption({ ...base, consent: "social", caption: "Clean taper for the weekend" }),
    ).toMatch(/^Clean taper for the weekend\n/);
  });
});

describe("canShare", () => {
  it("needs social consent and never shares kids", () => {
    expect(canShare("social", false)).toBe(true);
    expect(canShare("portfolio", false)).toBe(false);
    expect(canShare("social", true)).toBe(false);
  });
});
