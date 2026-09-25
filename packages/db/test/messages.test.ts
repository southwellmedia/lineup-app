import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { book, createShop } from "./fixtures";

const db = useTestDb();
const AT_10 = "2030-03-05T16:00:00Z";

async function appointment(shop: Awaited<ReturnType<typeof createShop>>, staffId: string) {
  return db.asService((c) =>
    book(c, {
      shopId: shop.shopId,
      staffId,
      startsAt: AT_10,
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
    }),
  );
}

const send = (shopId: string, clientId: string, appointmentId: string, kind = "confirmation") =>
  db.pool.query(
    `INSERT INTO messages (shop_id, client_id, appointment_id, direction, kind, phone, body, status)
     VALUES ($1, $2, $3, 'outbound', $4, '+12145550100', 'Hi', 'sent')`,
    [shopId, clientId, appointmentId, kind],
  );

describe("messages", () => {
  it("sends each confirmation and reminder once per booking", async () => {
    const shop = await createShop(db.pool);
    const appt = await appointment(shop, shop.barber.staffId);
    await send(shop.shopId, shop.clientId, appt.id);
    expect(await errorCode(send(shop.shopId, shop.clientId, appt.id))).toBe("23505");
    await send(shop.shopId, shop.clientId, appt.id, "reminder_24h");
    await send(shop.shopId, shop.clientId, appt.id, "reminder_2h");
  });

  it("is visible to managers and the client's barber, not to others", async () => {
    const shop = await createShop(db.pool);
    const appt = await appointment(shop, shop.barber.staffId);
    await send(shop.shopId, shop.clientId, appt.id);
    const count = (userId: string) =>
      db.asUser(userId, async (c) => (await c.query("SELECT id FROM messages")).rowCount);
    expect(await count(shop.owner.userId)).toBe(1);
    expect(await count(shop.barber.userId)).toBe(1);
    expect(await count(shop.otherBarber.userId)).toBe(0);
    const { rowCount } = await db.asAnon((c) => c.query("SELECT 1 FROM messages"));
    expect(rowCount).toBe(0);
  });

  it("can't be written by staff", async () => {
    const shop = await createShop(db.pool);
    expect(
      await errorCode(
        db.asUser(shop.owner.userId, (c) =>
          c.query(
            `INSERT INTO messages (shop_id, direction, kind, phone, body, status)
             VALUES ($1, 'outbound', 'reply', '+12145550100', 'x', 'sent')`,
            [shop.shopId],
          ),
        ),
      ),
    ).toBe("42501");
  });
});
