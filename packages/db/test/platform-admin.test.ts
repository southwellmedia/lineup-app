import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { createShop } from "./fixtures";

const db = useTestDb();

describe("platform admin", () => {
  it("keeps admins and the audit log away from signed-in users", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query("INSERT INTO platform_admins (user_id) VALUES ($1)", [shop.owner.userId]);
    await db.pool.query(
      "INSERT INTO admin_audit_log (admin_user_id, action, shop_id) VALUES ($1, 'shop.suspend', $2)",
      [shop.owner.userId, shop.shopId],
    );
    await db.asUser(shop.owner.userId, async (c) => {
      expect((await c.query("SELECT 1 FROM platform_admins")).rowCount).toBe(0);
      expect((await c.query("SELECT 1 FROM admin_audit_log")).rowCount).toBe(0);
    });
    expect(
      await errorCode(
        db.asUser(shop.owner.userId, (c) =>
          c.query("INSERT INTO platform_admins (user_id) VALUES ($1)", [shop.owner.userId]),
        ),
      ),
    ).toBe("42501");
  });

  it("never changes or deletes audit entries", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query(
      "INSERT INTO admin_audit_log (admin_user_id, action) VALUES ($1, 'shop.update')",
      [shop.owner.userId],
    );
    expect(await errorCode(db.pool.query("UPDATE admin_audit_log SET action = 'x'"))).toBe("LU422");
    expect(await errorCode(db.pool.query("DELETE FROM admin_audit_log"))).toBe("LU422");
  });

  it("stops owners changing their plan, premium access or suspension", async () => {
    const shop = await createShop(db.pool);
    for (const change of [
      "plan = CASE WHEN plan = 'solo' THEN 'shop'::shop_plan ELSE 'solo' END",
      "premium_templates = true",
      "suspended_at = NULL, suspended_reason = 'x'",
    ]) {
      expect(
        await errorCode(
          db.asUser(shop.owner.userId, (c) =>
            c.query(`UPDATE shops SET ${change} WHERE id = $1`, [shop.shopId]),
          ),
        ),
        change,
      ).toBe("LU422");
    }
    // Other settings still save, and the server can change the guarded ones.
    await db.asUser(shop.owner.userId, (c) =>
      c.query("UPDATE shops SET name = 'Renamed' WHERE id = $1", [shop.shopId]),
    );
    await db.asService((c) =>
      c.query("UPDATE shops SET premium_templates = true, suspended_at = now() WHERE id = $1", [
        shop.shopId,
      ]),
    );
  });

  it("reports per-shop stats only to the server", async () => {
    const shop = await createShop(db.pool);
    const { rows } = await db.asService((c) =>
      c.query("SELECT * FROM admin_shop_stats(now() - interval '30 days') WHERE shop_id = $1", [
        shop.shopId,
      ]),
    );
    expect(rows[0]).toMatchObject({ shop_id: shop.shopId, bookings: 0, texts_sent: 0 });
    expect(rows[0].staff).toBeGreaterThan(0);
    for (const fn of ["admin_shop_stats", "admin_booking_sources"]) {
      expect(
        await errorCode(db.asUser(shop.owner.userId, (c) => c.query(`SELECT * FROM ${fn}(now())`))),
        fn,
      ).toBe("42501");
    }
  });
});
