import { describe, expect, it } from "vitest";
import { useTestDb } from "./db";
import { book, createClient, createShop } from "./fixtures";

const db = useTestDb();

async function ids(
  run: (fn: (c: import("pg").PoolClient) => Promise<string[]>) => Promise<string[]>,
  sql: string,
  params: unknown[] = [],
) {
  return run(async (c) => (await c.query<{ id: string }>(sql, params)).rows.map((r) => r.id));
}

describe("tenant isolation", () => {
  it("keeps each shop's data invisible to other shops", async () => {
    const a = await createShop(db.pool);
    const b = await createShop(db.pool);
    const asOwnerA = <T>(fn: (c: import("pg").PoolClient) => Promise<T>) =>
      db.asUser(a.owner.userId, fn);

    expect(await ids(asOwnerA, "SELECT id FROM shops")).toEqual([a.shopId]);
    expect(await ids(asOwnerA, "SELECT id FROM clients")).toEqual([a.clientId]);
    expect(await ids(asOwnerA, "SELECT id FROM services WHERE shop_id = $1", [b.shopId])).toEqual(
      [],
    );
    expect(await ids(asOwnerA, "SELECT id FROM staff WHERE shop_id = $1", [b.shopId])).toEqual([]);

    // Writes to another shop are rejected, not silently applied.
    const updated = await db.asUser(a.owner.userId, (c) =>
      c.query("UPDATE shops SET name = 'Hijacked' WHERE id = $1", [b.shopId]),
    );
    expect(updated.rowCount).toBe(0);
  });

  it("gives anonymous visitors no direct table access", async () => {
    await createShop(db.pool);
    for (const table of [
      "shops",
      "staff",
      "services",
      "clients",
      "appointments",
      "payments",
      "site_events",
      "client_photos",
      "messages",
    ]) {
      const { rowCount } = await db.asAnon((c) => c.query(`SELECT 1 FROM ${table}`));
      expect(rowCount, table).toBe(0);
    }
  });

  it("lets one person belong to two shops", async () => {
    const a = await createShop(db.pool);
    const b = await createShop(db.pool);
    // Marcus rents a chair at shop A and runs his own solo shop B.
    await db.pool.query(
      "INSERT INTO staff (shop_id, user_id, role, display_name, slug) VALUES ($1, $2, 'owner', 'Marcus', 'marcus-solo')",
      [b.shopId, a.barber.userId],
    );
    const shops = await ids(
      (fn) => db.asUser(a.barber.userId, fn),
      "SELECT id FROM shops ORDER BY id",
    );
    expect(shops.sort()).toEqual([a.shopId, b.shopId].sort());
  });
});

describe("roles inside a shop", () => {
  it("shows barbers only their own appointments; managers see the whole calendar", async () => {
    const shop = await createShop(db.pool);
    const mine = await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        startsAt: "2030-01-01T16:00:00Z",
        serviceIds: [shop.services.fade],
        clientId: shop.clientId,
      }),
    );
    const theirs = await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.otherBarber.staffId,
        startsAt: "2030-01-01T16:00:00Z",
        serviceIds: [shop.services.fade],
        clientId: shop.clientId,
      }),
    );

    expect(
      await ids((fn) => db.asUser(shop.barber.userId, fn), "SELECT id FROM appointments"),
    ).toEqual([mine.id]);
    expect(
      (await ids((fn) => db.asUser(shop.owner.userId, fn), "SELECT id FROM appointments")).sort(),
    ).toEqual([mine.id, theirs.id].sort());
  });

  it("shows barbers only clients they have served or who prefer them, unless the shop shares clients", async () => {
    const shop = await createShop(db.pool);
    const regular = await createClient(
      db.pool,
      shop.shopId,
      "+12145550111",
      "Regular",
      shop.barber.staffId,
    );
    const stranger = await createClient(db.pool, shop.shopId, "+12145550112", "Stranger");
    const served = await createClient(db.pool, shop.shopId, "+12145550113", "Served");
    await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        startsAt: "2030-01-02T16:00:00Z",
        serviceIds: [shop.services.fade],
        clientId: served,
      }),
    );

    const visible = () => ids((fn) => db.asUser(shop.barber.userId, fn), "SELECT id FROM clients");

    expect((await visible()).sort()).toEqual([regular, served].sort());
    expect(await visible()).not.toContain(stranger);

    await db.pool.query("UPDATE shops SET share_clients_between_staff = true WHERE id = $1", [
      shop.shopId,
    ]);
    expect(await visible()).toContain(stranger);
  });

  it("only lets managers change shop settings and the roster", async () => {
    const shop = await createShop(db.pool);

    const barberUpdate = await db.asUser(shop.barber.userId, (c) =>
      c.query("UPDATE shops SET no_show_fee_cents = 5000 WHERE id = $1", [shop.shopId]),
    );
    expect(barberUpdate.rowCount).toBe(0);

    const ownerUpdate = await db.asUser(shop.owner.userId, (c) =>
      c.query("UPDATE shops SET no_show_fee_cents = 2000 WHERE id = $1", [shop.shopId]),
    );
    expect(ownerUpdate.rowCount).toBe(1);

    const promote = await db.asUser(shop.barber.userId, (c) =>
      c.query("UPDATE staff SET role = 'owner' WHERE id = $1", [shop.barber.staffId]),
    );
    expect(promote.rowCount).toBe(0);
  });

  it("lets a barber manage their own hours but not a colleague's", async () => {
    const shop = await createShop(db.pool);
    const insertHours = (staffId: string) =>
      db.asUser(shop.barber.userId, (c) =>
        c.query(
          "INSERT INTO working_hours (shop_id, staff_id, weekday, start_time, end_time) VALUES ($1, $2, 6, '09:00', '17:00')",
          [shop.shopId, staffId],
        ),
      );

    await insertHours(shop.barber.staffId);
    await expect(insertHours(shop.otherBarber.staffId)).rejects.toMatchObject({ code: "42501" });
  });

  it("drops access as soon as a staff member is deactivated", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query("UPDATE staff SET is_active = false WHERE id = $1", [shop.barber.staffId]);
    expect(await ids((fn) => db.asUser(shop.barber.userId, fn), "SELECT id FROM shops")).toEqual(
      [],
    );
  });
});
