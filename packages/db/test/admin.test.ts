import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { book, createClient, createShop } from "./fixtures";

const db = useTestDb();

const hours = (rows: [number, string, string][]) =>
  JSON.stringify(
    rows.map(([weekday, start_time, end_time]) => ({ weekday, start_time, end_time })),
  );

describe("set_working_hours", () => {
  it("replaces a barber's week in one go, breaks included", async () => {
    const shop = await createShop(db.pool);
    const week = hours([
      [2, "10:00", "14:00"],
      [2, "14:30", "19:00"],
      [6, "08:00", "16:00"],
    ]);
    const set = (json: string) =>
      db.asUser(shop.barber.userId, (c) =>
        c.query("SELECT * FROM set_working_hours($1, $2)", [shop.barber.staffId, json]),
      );

    expect((await set(week)).rowCount).toBe(3);
    expect((await set(hours([[3, "09:00", "17:00"]]))).rowCount).toBe(1);

    const { rows } = await db.pool.query("SELECT weekday FROM working_hours WHERE staff_id = $1", [
      shop.barber.staffId,
    ]);
    expect(rows).toEqual([{ weekday: 3 }]);
  });

  it("rejects overlapping blocks and leaves existing hours untouched", async () => {
    const shop = await createShop(db.pool);
    const set = (json: string) =>
      db.asUser(shop.barber.userId, (c) =>
        c.query("SELECT * FROM set_working_hours($1, $2)", [shop.barber.staffId, json]),
      );
    await set(hours([[1, "09:00", "17:00"]]));

    expect(
      await errorCode(
        set(
          hours([
            [2, "09:00", "13:00"],
            [2, "12:00", "18:00"],
          ]),
        ),
      ),
    ).toBe("LU422");
    expect(await errorCode(set(hours([[2, "18:00", "09:00"]])))).toBe("23514"); // end before start

    const { rows } = await db.pool.query("SELECT weekday FROM working_hours WHERE staff_id = $1", [
      shop.barber.staffId,
    ]);
    expect(rows).toEqual([{ weekday: 1 }]);
  });

  it("lets managers set anyone's hours but not barbers set a colleague's", async () => {
    const shop = await createShop(db.pool);
    const week = hours([[5, "10:00", "18:00"]]);

    await db.asUser(shop.owner.userId, (c) =>
      c.query("SELECT * FROM set_working_hours($1, $2)", [shop.barber.staffId, week]),
    );
    expect(
      await errorCode(
        db.asUser(shop.barber.userId, (c) =>
          c.query("SELECT * FROM set_working_hours($1, $2)", [shop.otherBarber.staffId, week]),
        ),
      ),
    ).toBe("42501");
  });
});

describe("client_stats", () => {
  it("counts visits, no-shows and spend, as the viewer is allowed to see them", async () => {
    const shop = await createShop(db.pool);
    const client = await createClient(db.pool, shop.shopId, "+12145550150", "Regular");
    const visit = (startsAt: string, staffId = shop.barber.staffId) =>
      db.asService((c) =>
        book(c, {
          shopId: shop.shopId,
          staffId,
          startsAt,
          serviceIds: [shop.services.fade],
          clientId: client,
        }),
      );

    const first = await visit("2030-01-01T16:00:00Z");
    await db.asUser(shop.barber.userId, (c) =>
      c.query("SELECT record_manual_payment($1, 'cash', p_tip_cents => 500)", [first.id]),
    );
    const second = await visit("2030-01-08T16:00:00Z", shop.otherBarber.staffId);
    await db.pool.query("UPDATE appointments SET status = 'no_show' WHERE id = $1", [second.id]);

    const stats = (userId: string) =>
      db.asUser(
        userId,
        async (c) =>
          (await c.query("SELECT * FROM client_stats WHERE client_id = $1", [client])).rows[0],
      );

    expect(await stats(shop.owner.userId)).toMatchObject({
      visits: 1,
      no_shows: 1,
      spent_cents: 3500,
    });
    // Marcus only sees his own chair: the visit he did, not Andre's no-show.
    expect(await stats(shop.barber.userId)).toMatchObject({
      visits: 1,
      no_shows: 0,
      spent_cents: 3500,
    });
  });

  it("shows nothing to anonymous visitors", async () => {
    await createShop(db.pool);
    const { rowCount } = await db.asAnon((c) => c.query("SELECT 1 FROM client_stats"));
    expect(rowCount).toBe(0);
  });
});

describe("shops.brand_color", () => {
  it("accepts #RRGGBB only", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query("UPDATE shops SET brand_color = '#1D4ED8' WHERE id = $1", [shop.shopId]);
    expect(
      await errorCode(
        db.pool.query("UPDATE shops SET brand_color = 'blue' WHERE id = $1", [shop.shopId]),
      ),
    ).toBe("23514");
  });
});

describe("shop profile", () => {
  it("stores contact details and rejects malformed ones", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query(
      `UPDATE shops SET tagline = 'Fades since 2009', phone = '+12145550100', instagram = 'southside.cuts',
         address_line = '123 Main St', city = 'Dallas', region = 'TX', postal_code = '75208', neighborhood = 'Oak Cliff'
       WHERE id = $1`,
      [shop.shopId],
    );
    expect(
      await errorCode(
        db.pool.query("UPDATE shops SET phone = '214-555' WHERE id = $1", [shop.shopId]),
      ),
    ).toBe("23514");
    expect(
      await errorCode(
        db.pool.query("UPDATE shops SET instagram = '@nope' WHERE id = $1", [shop.shopId]),
      ),
    ).toBe("23514");
  });
});

describe("shop connections", () => {
  it("accepts well-formed tracking ids and rejects anything else", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query(
      `UPDATE shops SET ga4_measurement_id = 'G-AB12CD34', meta_pixel_id = '123456789012345',
         google_site_verification = 'abcDEF123_-abcDEF123_-xyz' WHERE id = $1`,
      [shop.shopId],
    );
    for (const [column, value] of [
      ["ga4_measurement_id", "UA-1234-1"],
      ["ga4_measurement_id", 'G-abc"><script>'],
      ["meta_pixel_id", "12ab"],
      ["google_site_verification", "<meta name=x>"],
    ] as const) {
      expect(
        await errorCode(
          db.pool.query(`UPDATE shops SET ${column} = $2 WHERE id = $1`, [shop.shopId, value]),
        ),
        `${column}=${value}`,
      ).toBe("23514");
    }
  });
});
