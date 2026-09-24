import { describe, expect, it } from "vitest";
import { resolveTenant } from "./tenant";

describe("resolveTenant", () => {
  it("serves shops by subdomain of the root domain", () => {
    expect(resolveTenant("southside-cuts.lineup.site", "lineup.site")).toEqual({
      kind: "subdomain",
      slug: "southside-cuts",
    });
  });

  it("treats other hosts as custom domains, ignoring www and ports", () => {
    expect(resolveTenant("www.SouthsideCuts.com:443", "lineup.site")).toEqual({
      kind: "domain",
      domain: "southsidecuts.com",
    });
  });

  it("uses path mode on the platform's own hosts", () => {
    expect(resolveTenant("localhost:4321", undefined)).toEqual({ kind: "path" });
    expect(resolveTenant("lineup-sites.vercel.app", "lineup.site")).toEqual({ kind: "path" });
    expect(resolveTenant("lineup.site", "lineup.site")).toEqual({ kind: "path" });
  });

  it("rejects nested or odd subdomains", () => {
    expect(resolveTenant("a.b.lineup.site", "lineup.site")).toEqual({
      kind: "domain",
      domain: "a.b.lineup.site",
    });
  });
});
