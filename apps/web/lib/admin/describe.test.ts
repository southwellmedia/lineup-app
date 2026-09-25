import { describe, expect, it } from "vitest";
import { describeAudit } from "./describe";

describe("describeAudit", () => {
  it("puts admin changes in plain words", () => {
    expect(describeAudit("shop.suspend", { reason: "Unpaid invoice" })).toBe(
      "Suspended: Unpaid invoice",
    );
    expect(describeAudit("shop.unsuspend", {})).toBe("Lifted the suspension");
    expect(
      describeAudit("shop.update", {
        plan: { from: "solo", to: "shop" },
        premiumTemplates: { from: false, to: true },
      }),
    ).toBe("Changed plan solo → shop, unlocked premium templates");
    expect(describeAudit("shop.update", { premiumTemplates: { from: true, to: false } })).toBe(
      "Changed locked premium templates",
    );
  });
  it("falls back to the action name", () => {
    expect(describeAudit("shop.export", null)).toBe("shop.export");
  });
});
