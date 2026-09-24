import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { book, createShop } from "./fixtures";

const db = useTestDb();

const AT_10 = "2030-03-05T16:00:00Z"; // 10:00 in Dallas
const AT_1030 = "2030-03-05T16:30:00Z";
const AT_1035 = "2030-03-05T16:35:00Z";

describe("create_appointment", () => {
  it("prices and times a booking from its services, add-ons and buffer", async () => {
    const shop = await createShop(db.pool);
    const appt = await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        startsAt: AT_10,
        serviceIds: [shop.services.fade, shop.services.beard],
        clientId: shop.clientId,
      }),
    );

    expect(appt.status).toBe("confirmed");
    // 30 min fade + 15 min beard; the fade's 5 min buffer only blocks the calendar.
    expect(appt.ends_at.toISOString()).toBe("2030-03-05T16:45:00.000Z");
    expect(appt.blocked_until.toISOString()).toBe("2030-03-05T16:50:00.000Z");
    expect(appt.total_price_cents).toBe(5000);
    expect(appt.deposit_cents).toBe(1000);

    const { rows } = await db.pool.query(
      "SELECT name, price_cents FROM appointment_services WHERE appointment_id = $1 ORDER BY name",
      [appt.id],
    );
    expect(rows).toEqual([
      { name: "Beard", price_cents: 1500 },
      { name: "Fade", price_cents: 3500 },
    ]);
  });

  it("uses the barber's own price and duration when set", async () => {
    const shop = await createShop(db.pool);
    await db.pool.query(
      "UPDATE staff_services SET price_cents = 4500, duration_minutes = 45 WHERE staff_id = $1 AND service_id = $2",
      [shop.barber.staffId, shop.services.fade],
    );
    const appt = await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        startsAt: AT_10,
        serviceIds: [shop.services.fade],
        clientId: shop.clientId,
      }),
    );
    expect(appt.total_price_cents).toBe(4500);
    expect(appt.ends_at.toISOString()).toBe("2030-03-05T16:45:00.000Z");
  });

  it("rejects bad requests with a clear error code", async () => {
    const shop = await createShop(db.pool);
    const base = { shopId: shop.shopId, staffId: shop.barber.staffId, startsAt: AT_10 };

    // Add-on on its own.
    expect(
      await errorCode(
        db.asService((c) =>
          book(c, { ...base, serviceIds: [shop.services.beard], clientId: shop.clientId }),
        ),
      ),
    ).toBe("LU422");

    // Confirmed booking with no client.
    expect(
      await errorCode(db.asService((c) => book(c, { ...base, serviceIds: [shop.services.fade] }))),
    ).toBe("LU422");

    // Service the barber doesn't offer.
    await db.pool.query("DELETE FROM staff_services WHERE staff_id = $1 AND service_id = $2", [
      shop.barber.staffId,
      shop.services.lineup,
    ]);
    expect(
      await errorCode(
        db.asService((c) =>
          book(c, { ...base, serviceIds: [shop.services.lineup], clientId: shop.clientId }),
        ),
      ),
    ).toBe("LU404");

    // Inactive barber.
    await db.pool.query("UPDATE staff SET is_active = false WHERE id = $1", [
      shop.otherBarber.staffId,
    ]);
    expect(
      await errorCode(
        db.asService((c) =>
          book(c, {
            ...base,
            staffId: shop.otherBarber.staffId,
            serviceIds: [shop.services.fade],
            clientId: shop.clientId,
          }),
        ),
      ),
    ).toBe("LU404");

    // Another shop's client.
    const otherShop = await createShop(db.pool);
    expect(
      await errorCode(
        db.asService((c) =>
          book(c, { ...base, serviceIds: [shop.services.fade], clientId: otherShop.clientId }),
        ),
      ),
    ).toBe("LU404");
  });

  it("is only callable by the server", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      staffId: shop.barber.staffId,
      startsAt: AT_10,
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
    };
    const insufficientPrivilege = "42501";
    expect(await errorCode(db.asAnon((c) => book(c, args)))).toBe(insufficientPrivilege);
    expect(await errorCode(db.asUser(shop.owner.userId, (c) => book(c, args)))).toBe(
      insufficientPrivilege,
    );
  });
});

describe("double-booking prevention", () => {
  it("rejects an overlapping booking for the same barber", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      staffId: shop.barber.staffId,
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
    };
    await db.asService((c) => book(c, { ...args, startsAt: AT_10 }));

    expect(
      await errorCode(db.asService((c) => book(c, { ...args, startsAt: "2030-03-05T16:15:00Z" }))),
    ).toBe("LU409");
  });

  it("allows the same time with a different barber", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
      startsAt: AT_10,
    };
    await db.asService((c) => book(c, { ...args, staffId: shop.barber.staffId }));
    const second = await db.asService((c) =>
      book(c, { ...args, staffId: shop.otherBarber.staffId }),
    );
    expect(second.status).toBe("confirmed");
  });

  it("respects the cleanup buffer but allows back-to-back after it", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      staffId: shop.barber.staffId,
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
    };
    await db.asService((c) => book(c, { ...args, startsAt: AT_10 })); // busy until 10:35

    expect(await errorCode(db.asService((c) => book(c, { ...args, startsAt: AT_1030 })))).toBe(
      "LU409",
    );
    const next = await db.asService((c) => book(c, { ...args, startsAt: AT_1035 }));
    expect(next.status).toBe("confirmed");
  });

  it("frees the slot when an appointment is cancelled", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      staffId: shop.barber.staffId,
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
      startsAt: AT_10,
    };
    const first = await db.asService((c) => book(c, args));
    await db.asService((c) => c.query("SELECT cancel_appointment($1, 'client')", [first.id]));

    const rebooked = await db.asService((c) => book(c, args));
    expect(rebooked.status).toBe("confirmed");
  });

  it("lets exactly one of many simultaneous requests win the slot", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      staffId: shop.barber.staffId,
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
    };
    // Web, chat and voice all grabbing overlapping times at once.
    // Every start is within 35 minutes (30 min fade + 5 min buffer) of every other, so all pairs overlap.
    const starts = ["16:00", "16:10", "16:20", "16:00", "15:50", "16:05", "16:15", "16:00"];
    const results = await Promise.allSettled(
      starts.map((t) => db.asService((c) => book(c, { ...args, startsAt: `2030-03-05T${t}:00Z` }))),
    );

    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");
    expect(won).toHaveLength(1);
    for (const r of lost) {
      expect((r as PromiseRejectedResult).reason.code).toBe("LU409");
    }

    const { rows } = await db.pool.query(
      "SELECT count(*)::int AS n FROM appointments WHERE staff_id = $1 AND status = 'confirmed'",
      [shop.barber.staffId],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("slot holds", () => {
  it("blocks the slot while a client pays, then confirms", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      staffId: shop.barber.staffId,
      serviceIds: [shop.services.fade],
      startsAt: AT_10,
    };

    const hold = await db.asService((c) => book(c, { ...args, holdMinutes: 5 }));
    expect(hold.status).toBe("held");
    expect(hold.client_id).toBeNull();

    // Someone else tries the same slot on another channel.
    expect(
      await errorCode(
        db.asService((c) => book(c, { ...args, clientId: shop.clientId, bookedBy: "voice_agent" })),
      ),
    ).toBe("LU409");

    const { rows } = await db.asService((c) =>
      c.query("SELECT * FROM confirm_hold($1, $2)", [hold.id, shop.clientId]),
    );
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].client_id).toBe(shop.clientId);
    expect(rows[0].hold_expires_at).toBeNull();
  });

  it("releases an expired hold to the next booking, and refuses to confirm it", async () => {
    const shop = await createShop(db.pool);
    const args = {
      shopId: shop.shopId,
      staffId: shop.barber.staffId,
      serviceIds: [shop.services.fade],
      startsAt: AT_10,
    };

    const hold = await db.asService((c) => book(c, { ...args, holdMinutes: 5 }));
    await db.pool.query(
      "UPDATE appointments SET hold_expires_at = now() - interval '1 second' WHERE id = $1",
      [hold.id],
    );

    const booking = await db.asService((c) => book(c, { ...args, clientId: shop.clientId }));
    expect(booking.status).toBe("confirmed");

    const { rows } = await db.pool.query("SELECT status FROM appointments WHERE id = $1", [
      hold.id,
    ]);
    expect(rows[0].status).toBe("expired");

    expect(
      await errorCode(
        db.asService((c) => c.query("SELECT confirm_hold($1, $2)", [hold.id, shop.clientId])),
      ),
    ).toBe("LU410");
  });

  it("sweeps stale holds in bulk", async () => {
    const shop = await createShop(db.pool);
    const hold = await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        serviceIds: [shop.services.fade],
        startsAt: AT_10,
        holdMinutes: 5,
      }),
    );
    await db.pool.query(
      "UPDATE appointments SET hold_expires_at = now() - interval '1 minute' WHERE id = $1",
      [hold.id],
    );

    const { rows } = await db.asService((c) => c.query("SELECT expire_stale_holds() AS n"));
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });
});

describe("appointment status", () => {
  it("never reopens a cancelled appointment", async () => {
    const shop = await createShop(db.pool);
    const appt = await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        serviceIds: [shop.services.fade],
        clientId: shop.clientId,
        startsAt: AT_10,
      }),
    );
    await db.asService((c) =>
      c.query("SELECT cancel_appointment($1, 'shop', 'Barber sick')", [appt.id]),
    );

    expect(
      await errorCode(
        db.pool.query("UPDATE appointments SET status = 'confirmed' WHERE id = $1", [appt.id]),
      ),
    ).toBe("LU422");
  });
});
