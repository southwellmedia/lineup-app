type Change = { from?: unknown; to?: unknown };

const record = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const change = (v: unknown): Change | null =>
  typeof v === "object" && v !== null ? (v as Change) : null;

/** One audit entry in plain words. */
export function describeAudit(action: string, detail: unknown): string {
  const d = record(detail);
  switch (action) {
    case "shop.suspend":
      return `Suspended${typeof d.reason === "string" ? `: ${d.reason}` : ""}`;
    case "shop.unsuspend":
      return "Lifted the suspension";
    case "shop.update": {
      const parts: string[] = [];
      const plan = change(d.plan);
      const premium = change(d.premiumTemplates);
      if (plan) parts.push(`plan ${String(plan.from)} → ${String(plan.to)}`);
      if (premium)
        parts.push(premium.to ? "unlocked premium templates" : "locked premium templates");
      return parts.length ? `Changed ${parts.join(", ")}` : "Updated the shop";
    }
    default:
      return action;
  }
}
