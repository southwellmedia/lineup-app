import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { book, createShop } from "./fixtures";

const db = useTestDb();

const AT_10 = "2030-03-05T16:00:00Z"; // 10:00 in Dallas
const AT_11 = "2030-03-05T17:00:00Z";

type Moved = { staff_id: string; starts_at: Date; ends_at: Date; blocked_until: Date };

const move = (c: import("pg").ClientBase, id: string, startsAt: string, staffId: string) =>
  c
    .query<Moved>("SELECT * FROM public.reschedule_appointment($1, $2, $3)", [
      id,
      startsAt,
      staffId,
    ])
    .then((r) => r.rows[0]!);

describe("walk-in clients", () => {
  it("can be saved without a phone number, any number of times", async () => {
    const shop = await createShop(db.pool);
    for (const name of ["Walk-in one", "Walk-in two"]) {
      await db.pool.query("INSERT INTO clients (shop_id, name) VALUES ($1, $2)", [
        shop.shopId,
        name,
      ]);
    }
    const { rows } = await db.pool.query(
      "SELECT count(*)::int AS n FROM clients WHERE shop_id = $1 AND phone IS NULL",
      [shop.shopId],
    );
    expect(rows[0].n).toBe(2);
  });

  it("still rejects duplicate phone numbers", async () => {
    const shop = await createShop(db.pool);
    expect(
      await errorCode(
        db.pool.query(
          "INSERT INTO clients (shop_id, name, phone) VALUES ($1, 'Dup', '+12145550100')",
          [shop.shopId],
        ),
      ),
    ).toBe("23505");
  });
});

describe("reschedule_appointment", () => {
  const bookFade = (shop: Awaited<ReturnType<typeof createShop>>, startsAt = AT_10) =>
    db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        startsAt,
        serviceIds: [shop.services.fade],
        clientId: shop.clientId,
      }),
    );

  it("moves a booking and keeps its length and buffer", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    const moved = await db.asService((c) => move(c, appt.id, AT_11, shop.otherBarber.staffId));
    expect(moved.staff_id).toBe(shop.otherBarber.staffId);
    expect(moved.starts_at.toISOString()).toBe("2030-03-05T17:00:00.000Z");
    expect(moved.ends_at.toISOString()).toBe("2030-03-05T17:30:00.000Z");
    expect(moved.blocked_until.toISOString()).toBe("2030-03-05T17:35:00.000Z");
  });

  it("refuses to overlap another booking", async () => {
    const shop = await createShop(db.pool);
    const first = await bookFade(shop, AT_10);
    const second = await bookFade(shop, AT_11);
    expect(
      await errorCode(
        db.asService((c) => move(c, second.id, "2030-03-05T16:15:00Z", shop.barber.staffId)),
      ),
    ).toBe("LU409");
    // Moving onto its own old slot is fine.
    await db.asService((c) => move(c, first.id, "2030-03-05T16:10:00Z", shop.barber.staffId));
  });

  it("only moves confirmed bookings, to barbers who offer the services", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    await db.pool.query("DELETE FROM staff_services WHERE staff_id = $1 AND service_id = $2", [
      shop.otherBarber.staffId,
      shop.services.fade,
    ]);
    expect(
      await errorCode(db.asService((c) => move(c, appt.id, AT_11, shop.otherBarber.staffId))),
    ).toBe("LU404");

    await db.pool.query("UPDATE appointments SET status = 'checked_in' WHERE id = $1", [appt.id]);
    expect(await errorCode(db.asService((c) => move(c, appt.id, AT_11, shop.barber.staffId)))).toBe(
      "LU422",
    );
  });

  it("is server-only", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    expect(
      await errorCode(
        db.asUser(shop.owner.userId, (c) => move(c, appt.id, AT_11, shop.barber.staffId)),
      ),
    ).toBe("42501");
  });
});
