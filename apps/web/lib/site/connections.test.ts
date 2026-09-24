import { describe, expect, it } from "vitest";
import { parseGa4, parseMetaPixel, parseSiteVerification } from "./connections";

describe("parseGa4", () => {
  it("takes a bare id or finds it in the gtag snippet", () => {
    expect(parseGa4("g-ab12cd34ef")).toEqual({ value: "G-AB12CD34EF" });
    expect(
      parseGa4(
        `<script async src="https://www.googletagmanager.com/gtag/js?id=G-AB12CD34EF"></script>`,
      ),
    ).toEqual({ value: "G-AB12CD34EF" });
  });
  it("treats blank as remove and rejects Universal Analytics ids", () => {
    expect(parseGa4("  ")).toEqual({ value: null });
    expect(parseGa4("UA-12345-1")).toHaveProperty("error");
  });
});

describe("parseMetaPixel", () => {
  it("takes a bare id or finds it in the pixel snippet", () => {
    expect(parseMetaPixel("123456789012345")).toEqual({ value: "123456789012345" });
    expect(parseMetaPixel(`fbq('init', '123456789012345');\nfbq('track', 'PageView');`)).toEqual({
      value: "123456789012345",
    });
  });
  it("rejects anything that isn't a pixel id", () => {
    expect(parseMetaPixel("12ab")).toHaveProperty("error");
  });
});

describe("parseSiteVerification", () => {
  const token = "abcDEF123_-abcDEF123_-xyz";
  it("takes the meta tag or the bare token", () => {
    expect(
      parseSiteVerification(`<meta name="google-site-verification" content="${token}" />`),
    ).toEqual({ value: token });
    expect(parseSiteVerification(token)).toEqual({ value: token });
  });
  it("rejects anything else", () => {
    expect(parseSiteVerification("<script>alert(1)</script>")).toHaveProperty("error");
  });
});
