import { describe, expect, it } from "vitest";
import { clientIp, deviceOf, isBot, referrerOf, sitePath, visitorHash } from "./event";

const base = { salt: "s", day: "2030-03-05", shopId: "shop", ip: "1.2.3.4", userAgent: "UA" };

describe("visitorHash", () => {
  it("is stable within a day and changes across days, shops and people", () => {
    const h = visitorHash(base);
    expect(h).toHaveLength(32);
    expect(visitorHash(base)).toBe(h);
    expect(visitorHash({ ...base, day: "2030-03-06" })).not.toBe(h);
    expect(visitorHash({ ...base, shopId: "other" })).not.toBe(h);
    expect(visitorHash({ ...base, ip: "5.6.7.8" })).not.toBe(h);
  });
});

describe("filters", () => {
  it("drops bots and empty user agents", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("facebookexternalhit/1.1")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(false);
  });
  it("tells phones from computers", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile")).toBe(
      "mobile",
    );
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
  });
});

describe("referrerOf", () => {
  const own = ["southsidecuts.com", "lineup-sites.vercel.app"];
  it("prefers utm_source", () => {
    expect(referrerOf("https://l.instagram.com/", "Instagram", own)).toBe("instagram");
  });
  it("folds big platforms into one channel each", () => {
    expect(referrerOf("https://www.google.com/search?q=x", undefined, own)).toBe("google");
    expect(referrerOf("https://www.google.co.uk/", undefined, own)).toBe("google");
    expect(referrerOf("https://l.instagram.com/?u=x", undefined, own)).toBe("instagram");
    expect(referrerOf(undefined, "IG", own)).toBe("instagram");
    expect(referrerOf("https://m.facebook.com/", undefined, own)).toBe("facebook");
    expect(referrerOf("https://t.co/abc", undefined, own)).toBe("x");
  });
  it("keeps other referring hosts without www", () => {
    expect(referrerOf("https://www.dallasobserver.com/best-of", undefined, own)).toBe(
      "dallasobserver.com",
    );
  });
  it("ignores direct visits, internal clicks and junk", () => {
    expect(referrerOf(undefined, undefined, own)).toBeNull();
    expect(referrerOf("https://www.southsidecuts.com/services", undefined, own)).toBeNull();
    expect(referrerOf("not a url", undefined, own)).toBeNull();
  });
});

describe("sitePath", () => {
  it("normalizes path mode and custom-domain paths", () => {
    expect(sitePath("/southside-cuts", "southside-cuts")).toBe("/");
    expect(sitePath("/southside-cuts/", "southside-cuts")).toBe("/");
    expect(sitePath("/southside-cuts/services/fade?x=1", "southside-cuts")).toBe("/services/fade");
    expect(sitePath("/services/fade/", "southside-cuts")).toBe("/services/fade");
    expect(sitePath("/southside-cuts-2", "southside-cuts")).toBe("/southside-cuts-2");
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address", () => {
    expect(clientIp("203.0.113.9, 10.0.0.1")).toBe("203.0.113.9");
    expect(clientIp(null)).toBe("");
  });
});
