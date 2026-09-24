import type pg from "pg";
import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { createShop } from "./fixtures";

const db = useTestDb();

const upload =
  (shopId: string, file = "hero.jpg") =>
  (c: pg.PoolClient) =>
    c.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('site-media', $1)", [
      `${shopId}/${file}`,
    ]);

describe("site design", () => {
  it("defaults to the classic template with empty content", async () => {
    const shop = await createShop(db.pool);
    const { rows } = await db.pool.query(
      "SELECT site_template, site_content FROM shops WHERE id = $1",
      [shop.shopId],
    );
    expect(rows[0]).toEqual({ site_template: "classic", site_content: {} });
  });

  it("rejects unknown templates and non-object content", async () => {
    const shop = await createShop(db.pool);
    expect(
      await errorCode(
        db.pool.query("UPDATE shops SET site_template = 'nope' WHERE id = $1", [shop.shopId]),
      ),
    ).toBe("23514");
    expect(
      await errorCode(
        db.pool.query("UPDATE shops SET site_content = '[]' WHERE id = $1", [shop.shopId]),
      ),
    ).toBe("23514");
  });
});

describe("site-media storage", () => {
  it("lets owners and managers upload into their own shop's folder", async () => {
    const shop = await createShop(db.pool);
    await db.asUser(shop.owner.userId, upload(shop.shopId));
    const { rows } = await db.asUser(shop.owner.userId, (c) =>
      c.query("SELECT name FROM storage.objects WHERE bucket_id = 'site-media'"),
    );
    expect(rows).toEqual([{ name: `${shop.shopId}/hero.jpg` }]);
  });

  it("keeps barbers, other shops and visitors out", async () => {
    const shop = await createShop(db.pool);
    const other = await createShop(db.pool);
    const denied = "42501";
    expect(await errorCode(db.asUser(shop.barber.userId, upload(shop.shopId)))).toBe(denied);
    expect(await errorCode(db.asUser(other.owner.userId, upload(shop.shopId)))).toBe(denied);
    expect(await errorCode(db.asAnon(upload(shop.shopId)))).toBe(denied);
    // Paths that aren't "<shop id>/<file>" are refused, not errors.
    expect(await errorCode(db.asUser(shop.owner.userId, upload(shop.shopId, "nested/x.jpg")))).toBe(
      denied,
    );
  });

  it("only lets a shop's managers delete its files", async () => {
    const shop = await createShop(db.pool);
    const other = await createShop(db.pool);
    await db.asService(upload(shop.shopId));
    const removed = await db.asUser(other.owner.userId, (c) =>
      c.query("DELETE FROM storage.objects WHERE bucket_id = 'site-media'"),
    );
    expect(removed.rowCount).toBe(0);
    const mine = await db.asUser(shop.owner.userId, (c) =>
      c.query("DELETE FROM storage.objects WHERE bucket_id = 'site-media'"),
    );
    expect(mine.rowCount).toBe(1);
  });
});
