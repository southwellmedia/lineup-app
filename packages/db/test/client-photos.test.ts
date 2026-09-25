import type pg from "pg";
import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { book, createClient, createShop } from "./fixtures";

const db = useTestDb();
const AT_10 = "2030-03-05T16:00:00Z";

type Shop = Awaited<ReturnType<typeof createShop>>;

const addPhoto =
  (shop: Shop, clientId: string, takenBy: string, file = "cut.jpg") =>
  (c: pg.PoolClient) =>
    c.query(
      `INSERT INTO client_photos (shop_id, client_id, taken_by, path) VALUES ($1, $2, $3, $4) RETURNING id`,
      [shop.shopId, clientId, takenBy, `${shop.shopId}/${clientId}/${file}`],
    );

const uploadObject = (shop: Shop, clientId: string) => (c: pg.PoolClient) =>
  c.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('client-photos', $1)", [
    `${shop.shopId}/${clientId}/cut.jpg`,
  ]);

describe("client photos", () => {
  it("follow the client's visibility: managers and barbers who served them", async () => {
    const shop = await createShop(db.pool);
    await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        startsAt: AT_10,
        serviceIds: [shop.services.fade],
        clientId: shop.clientId,
      }),
    );
    // The barber who cut them can add a photo and a file.
    await db.asUser(shop.barber.userId, addPhoto(shop, shop.clientId, shop.barber.staffId));
    await db.asUser(shop.barber.userId, uploadObject(shop, shop.clientId));

    const seen = (userId: string) =>
      db.asUser(userId, async (c) => (await c.query("SELECT id FROM client_photos")).rowCount);
    expect(await seen(shop.owner.userId)).toBe(1);
    expect(await seen(shop.barber.userId)).toBe(1);
    // Another barber who never served this client sees nothing.
    expect(await seen(shop.otherBarber.userId)).toBe(0);
    expect(
      await errorCode(
        db.asUser(
          shop.otherBarber.userId,
          addPhoto(shop, shop.clientId, shop.otherBarber.staffId, "b.jpg"),
        ),
      ),
    ).toBe("42501");
    expect(
      await errorCode(db.asUser(shop.otherBarber.userId, uploadObject(shop, shop.clientId))),
    ).toBe("42501");
  });

  it("keeps other shops and visitors out", async () => {
    const shop = await createShop(db.pool);
    const other = await createShop(db.pool);
    await db.asService(addPhoto(shop, shop.clientId, shop.owner.staffId));
    const count = await db.asUser(
      other.owner.userId,
      async (c) => (await c.query("SELECT id FROM client_photos")).rowCount,
    );
    expect(count).toBe(0);
    expect(await errorCode(db.asAnon(uploadObject(shop, shop.clientId)))).toBe("42501");
    expect(await errorCode(db.asUser(other.owner.userId, uploadObject(shop, shop.clientId)))).toBe(
      "42501",
    );
  });

  it("can't be recorded as someone else", async () => {
    const shop = await createShop(db.pool);
    expect(
      await errorCode(
        db.asUser(shop.owner.userId, addPhoto(shop, shop.clientId, shop.barber.staffId)),
      ),
    ).toBe("42501");
  });

  it("needs a consent time to go public, and kids' photos stay private", async () => {
    const shop = await createShop(db.pool);
    const kid = await createClient(db.pool, shop.shopId, "+12145550111", "Junior");
    await db.pool.query("UPDATE clients SET is_minor = true WHERE id = $1", [kid]);
    const { rows } = await db.asService(addPhoto(shop, shop.clientId, shop.owner.staffId));
    const photoId = rows[0].id as string;

    expect(
      await errorCode(
        db.pool.query("UPDATE client_photos SET consent = 'social' WHERE id = $1", [photoId]),
      ),
    ).toBe("23514");
    await db.pool.query(
      "UPDATE client_photos SET consent = 'social', consent_at = now() WHERE id = $1",
      [photoId],
    );

    const kidPhoto = await db.asService(addPhoto(shop, kid, shop.owner.staffId, "kid.jpg"));
    expect(
      await errorCode(
        db.pool.query(
          "UPDATE client_photos SET consent = 'portfolio', consent_at = now() WHERE id = $1",
          [kidPhoto.rows[0].id],
        ),
      ),
    ).toBe("LU422");
  });

  it("rejects paths outside the shop and client folder", async () => {
    const shop = await createShop(db.pool);
    const other = await createShop(db.pool);
    expect(
      await errorCode(
        db.pool.query("INSERT INTO client_photos (shop_id, client_id, path) VALUES ($1, $2, $3)", [
          shop.shopId,
          shop.clientId,
          `${other.shopId}/${shop.clientId}/x.jpg`,
        ]),
      ),
    ).toBe("23514");
  });

  it("lets managers or the photographer delete", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query("UPDATE shops SET share_clients_between_staff = true WHERE id = $1", [
      shop.shopId,
    ]);
    await db.asService(addPhoto(shop, shop.clientId, shop.barber.staffId));
    const del = (userId: string) =>
      db.asUser(userId, async (c) => (await c.query("DELETE FROM client_photos")).rowCount);
    expect(await del(shop.otherBarber.userId)).toBe(0);
    expect(await del(shop.barber.userId)).toBe(1);
  });
});
