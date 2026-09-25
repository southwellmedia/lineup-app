import { describe, expect, it } from "vitest";
import { useTestDb } from "./db";
import { createShop } from "./fixtures";

const db = useTestDb();

describe("site cache purge triggers", () => {
  it("are on every table a shop's website reads", async () => {
    const { rows } = await db.pool.query<{ table: string }>(
      `SELECT DISTINCT event_object_table AS table FROM information_schema.triggers
       WHERE trigger_name LIKE '%purge_site_cache%' ORDER BY 1`,
    );
    expect(rows.map((r) => r.table)).toEqual([
      "services",
      "shops",
      "staff",
      "staff_services",
      "working_hours",
    ]);
  });

  it("don't get in the way of edits when nothing can be purged", async () => {
    const shop = await createShop(db.pool);
    await db.asUser(shop.owner.userId, async (c) => {
      await c.query("UPDATE shops SET tagline = 'Fresh' WHERE id = $1", [shop.shopId]);
      await c.query("UPDATE services SET sort_order = sort_order + 1 WHERE shop_id = $1", [
        shop.shopId,
      ]);
      await c.query("DELETE FROM staff_services WHERE shop_id = $1", [shop.shopId]);
    });
  });

  it("can't be called directly by signed-in users", async () => {
    const shop = await createShop(db.pool);
    await expect(
      db.asUser(shop.owner.userId, (c) =>
        c.query("SELECT private.purge_site_cache(ARRAY[$1]::uuid[])", [shop.shopId]),
      ),
    ).rejects.toThrow();
  });
});
