import { describe, expect, it } from "vitest";
import { useTestDb } from "./db";
import { createShop } from "./fixtures";

const db = useTestDb();

const V1 = "a".repeat(32);
const V2 = "b".repeat(32);

async function event(
  shopId: string,
  at: string,
  kind: string,
  visitor: string,
  extra: { path?: string; referrer?: string | null; source?: string | null } = {},
) {
  await db.pool.query(
    `INSERT INTO site_events (shop_id, occurred_at, kind, path, referrer, source, visitor, device)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'mobile')`,
    [shopId, at, kind, extra.path ?? "/", extra.referrer ?? null, extra.source ?? null, visitor],
  );
}

type Report = {
  totals: { pageviews: number; visitors: number; bookClicks: number; bookingViewsFromSite: number };
  daily: { day: string; visitors: number; pageviews: number; bookClicks: number }[];
  pages: { path: string; pageviews: number }[];
  referrers: { referrer: string | null; visitors: number }[];
  bookingSources: { source: string | null; visitors: number }[];
};

const report = (userId: string, shopId: string) =>
  db.asUser(userId, async (c) => {
    const { rows } = await c.query<{ r: Report }>(
      "SELECT site_analytics($1, '2030-03-01T00:00:00Z', '2030-03-10T00:00:00Z') AS r",
      [shopId],
    );
    return rows[0]!.r;
  });

describe("site_analytics", () => {
  it("counts visitors per local day, clicks, pages and referrers", async () => {
    const shop = await createShop(db.pool);
    // Day 1 (Dallas): V1 twice, V2 once from Instagram. 03:00Z on the 6th is still the 5th locally.
    await event(shop.shopId, "2030-03-05T16:00:00Z", "pageview", V1);
    await event(shop.shopId, "2030-03-05T16:01:00Z", "pageview", V1, { path: "/services/fade" });
    await event(shop.shopId, "2030-03-06T03:00:00Z", "pageview", V2, { referrer: "instagram.com" });
    await event(shop.shopId, "2030-03-05T16:02:00Z", "book_click", V1);
    // Day 2: V1 again counts as a new daily visitor.
    await event(shop.shopId, "2030-03-06T16:00:00Z", "pageview", V1);
    await event(shop.shopId, "2030-03-06T16:05:00Z", "booking_view", V1, {
      path: "/book",
      source: "website",
    });
    await event(shop.shopId, "2030-03-06T17:00:00Z", "booking_view", V2, {
      path: "/book",
      source: "instagram",
    });
    // Outside the window.
    await event(shop.shopId, "2030-02-01T16:00:00Z", "pageview", V2);

    const r = await report(shop.owner.userId, shop.shopId);
    expect(r.totals).toEqual({ pageviews: 4, visitors: 3, bookClicks: 1, bookingViewsFromSite: 1 });
    expect(r.daily).toEqual([
      { day: "2030-03-05", visitors: 2, pageviews: 3, bookClicks: 1 },
      { day: "2030-03-06", visitors: 1, pageviews: 1, bookClicks: 0 },
    ]);
    expect(r.pages[0]).toEqual({ path: "/", pageviews: 3 });
    expect(r.referrers).toEqual([
      { referrer: null, visitors: 2 },
      { referrer: "instagram.com", visitors: 1 },
    ]);
    expect(r.bookingSources).toHaveLength(2);
  });

  it("shows barbers and other shops nothing", async () => {
    const shop = await createShop(db.pool);
    const other = await createShop(db.pool);
    await event(shop.shopId, "2030-03-05T16:00:00Z", "pageview", V1);

    const barber = await report(shop.barber.userId, shop.shopId);
    expect(barber.totals.pageviews).toBe(0);
    const outsider = await report(other.owner.userId, shop.shopId);
    expect(outsider.totals.pageviews).toBe(0);

    const { rowCount } = await db.asAnon((c) => c.query("SELECT 1 FROM site_events"));
    expect(rowCount).toBe(0);
  });

  it("only lets the server write events", async () => {
    const shop = await createShop(db.pool);
    const insert = (c: import("pg").PoolClient) =>
      c.query(
        `INSERT INTO site_events (shop_id, kind, path, visitor, device) VALUES ($1, 'pageview', '/', $2, 'mobile')`,
        [shop.shopId, V1],
      );
    await expect(db.asUser(shop.owner.userId, insert)).rejects.toThrow();
    await expect(db.asAnon(insert)).rejects.toThrow();
    await db.asService(insert);
  });
});
