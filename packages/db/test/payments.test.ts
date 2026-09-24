import { describe, expect, it } from "vitest";
import { errorCode, useTestDb } from "./db";
import { book, createShop, type ShopFixture } from "./fixtures";

const db = useTestDb();

let slot = 0;
/** A fresh, non-overlapping start time for each booking in this file. */
function nextStart() {
  slot += 1;
  return new Date(Date.UTC(2030, 5, 1, 0, 0) + slot * 60 * 60_000).toISOString();
}

async function bookFade(shop: ShopFixture, staffId = shop.barber.staffId) {
  return db.asService((c) =>
    book(c, {
      shopId: shop.shopId,
      staffId,
      startsAt: nextStart(),
      serviceIds: [shop.services.fade],
      clientId: shop.clientId,
    }),
  );
}

type Balance = { paid_cents: number; tip_cents: number; balance_due_cents: number };

async function balance(appointmentId: string): Promise<Balance> {
  const { rows } = await db.pool.query<Balance>(
    "SELECT paid_cents, tip_cents, balance_due_cents FROM appointment_balances WHERE appointment_id = $1",
    [appointmentId],
  );
  const row = rows[0];
  if (!row) throw new Error("no balance row");
  return row;
}

describe("marking a booking paid (cash and off-platform)", () => {
  it("records the full balance plus tip and completes the appointment", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);

    const payment = await db.asUser(shop.barber.userId, async (c) => {
      const { rows } = await c.query(
        "SELECT * FROM record_manual_payment(p_appointment_id => $1, p_method => 'cash', p_tip_cents => 500)",
        [appt.id],
      );
      return rows[0];
    });

    expect(payment).toMatchObject({
      kind: "service",
      method: "cash",
      amount_cents: 3500,
      tip_cents: 500,
      staff_id: shop.barber.staffId,
      client_id: shop.clientId,
      recorded_by: shop.barber.userId,
    });
    expect(await balance(appt.id)).toEqual({
      paid_cents: 3500,
      tip_cents: 500,
      balance_due_cents: 0,
    });

    const { rows } = await db.pool.query("SELECT status FROM appointments WHERE id = $1", [
      appt.id,
    ]);
    expect(rows[0].status).toBe("completed");
  });

  it("supports split payments across methods", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);

    await db.asUser(shop.barber.userId, (c) =>
      c.query(
        "SELECT record_manual_payment($1, 'external', p_amount_cents => 1000, p_note => 'Cash App')",
        [appt.id],
      ),
    );
    expect((await balance(appt.id)).balance_due_cents).toBe(2500);

    await db.asUser(shop.barber.userId, (c) =>
      c.query("SELECT record_manual_payment($1, 'cash')", [appt.id]),
    );
    expect((await balance(appt.id)).balance_due_cents).toBe(0);
  });

  it("refuses to record nothing, card payments, or payments for a hold", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    await db.asUser(shop.barber.userId, (c) =>
      c.query("SELECT record_manual_payment($1, 'cash')", [appt.id]),
    );

    // Already paid and no tip.
    expect(
      await errorCode(
        db.asUser(shop.barber.userId, (c) =>
          c.query("SELECT record_manual_payment($1, 'cash')", [appt.id]),
        ),
      ),
    ).toBe("LU422");

    // A tip after the fact is fine.
    await db.asUser(shop.barber.userId, (c) =>
      c.query("SELECT record_manual_payment($1, 'cash', p_tip_cents => 300)", [appt.id]),
    );
    expect((await balance(appt.id)).tip_cents).toBe(300);

    const fresh = await bookFade(shop);
    expect(
      await errorCode(
        db.asUser(shop.barber.userId, (c) =>
          c.query("SELECT record_manual_payment($1, 'card')", [fresh.id]),
        ),
      ),
    ).toBe("LU422");

    const hold = await db.asService((c) =>
      book(c, {
        shopId: shop.shopId,
        staffId: shop.barber.staffId,
        startsAt: nextStart(),
        serviceIds: [shop.services.fade],
        holdMinutes: 5,
      }),
    );
    expect(
      await errorCode(
        db.asUser(shop.barber.userId, (c) =>
          c.query("SELECT record_manual_payment($1, 'cash')", [hold.id]),
        ),
      ),
    ).toBe("LU422");
  });

  it("lets managers take payment for anyone, but not barbers for each other", async () => {
    const shop = await createShop(db.pool);
    const andresCut = await bookFade(shop, shop.otherBarber.staffId);

    expect(
      await errorCode(
        db.asUser(shop.barber.userId, (c) =>
          c.query("SELECT record_manual_payment($1, 'cash')", [andresCut.id]),
        ),
      ),
    ).toBe("LU404");

    await db.asUser(shop.owner.userId, (c) =>
      c.query("SELECT record_manual_payment($1, 'cash')", [andresCut.id]),
    );
    expect((await balance(andresCut.id)).balance_due_cents).toBe(0);
  });

  it("stops a barber inserting a payment row directly against another barber's appointment", async () => {
    const shop = await createShop(db.pool);
    const andresCut = await bookFade(shop, shop.otherBarber.staffId);

    const code = await errorCode(
      db.asUser(shop.barber.userId, (c) =>
        c.query(
          `INSERT INTO payments (shop_id, appointment_id, staff_id, kind, method, amount_cents, recorded_by)
           VALUES ($1, $2, $3, 'service', 'cash', 3500, $4)`,
          [shop.shopId, andresCut.id, shop.barber.staffId, shop.barber.userId],
        ),
      ),
    );
    expect(code).toBe("42501"); // row-level security violation
  });
});

describe("the payments ledger", () => {
  it("cannot be edited or deleted, even by a superuser", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    const { rows } = await db.asUser(shop.barber.userId, (c) =>
      c.query("SELECT id FROM record_manual_payment($1, 'cash')", [appt.id]),
    );
    const paymentId = rows[0].id;

    expect(
      await errorCode(
        db.pool.query("UPDATE payments SET amount_cents = 1 WHERE id = $1", [paymentId]),
      ),
    ).toBe("LU422");
    expect(await errorCode(db.pool.query("DELETE FROM payments WHERE id = $1", [paymentId]))).toBe(
      "LU422",
    );
  });

  it("records refunds as new rows and never refunds more than was paid", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    const { rows } = await db.asUser(shop.barber.userId, (c) =>
      c.query("SELECT id FROM record_manual_payment($1, 'cash')", [appt.id]),
    );
    const paymentId: string = rows[0].id;

    const refund = (amount: number, method = "cash") =>
      db.asUser(shop.barber.userId, (c) =>
        c.query(
          `INSERT INTO payments
             (shop_id, appointment_id, client_id, staff_id, kind, method, amount_cents, refunds_payment_id, recorded_by)
           VALUES ($1, $2, $3, $4, 'refund', $5, $6, $7, $8)`,
          [
            shop.shopId,
            appt.id,
            shop.clientId,
            shop.barber.staffId,
            method,
            amount,
            paymentId,
            shop.barber.userId,
          ],
        ),
      );

    await refund(-2000);
    expect((await balance(appt.id)).balance_due_cents).toBe(2000);

    expect(await errorCode(refund(-2000))).toBe("LU422"); // would total $40 on a $35 payment
    expect(await errorCode(refund(-500, "external"))).toBe("LU422"); // must match original method
    await refund(-1500);
    expect((await balance(appt.id)).paid_cents).toBe(0);
  });

  it("requires a Stripe trail and a destination account for card payments", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    const checkViolation = "23514";

    expect(
      await errorCode(
        db.asService((c) =>
          c.query(
            `INSERT INTO payments (shop_id, appointment_id, kind, method, amount_cents)
             VALUES ($1, $2, 'service', 'card', 3500)`,
            [shop.shopId, appt.id],
          ),
        ),
      ),
    ).toBe(checkViolation);
  });

  it("records a card payment from Stripe once, whichever account it lands in", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);

    // The booth-renter model: this barber has their own connected account.
    const { rows } = await db.pool.query(
      `INSERT INTO payment_accounts (shop_id, staff_id, external_account_id, charges_enabled)
       VALUES ($1, $2, 'acct_barber', true) RETURNING id`,
      [shop.shopId, shop.barber.staffId],
    );
    const accountId: string = rows[0].id;

    const insertCharge = () =>
      db.asService((c) =>
        c.query(
          `INSERT INTO payments
             (shop_id, appointment_id, staff_id, kind, method, amount_cents, tip_cents,
              processing_fee_cents, payment_account_id, stripe_payment_intent_id)
           VALUES ($1, $2, $3, 'service', 'card', 3500, 700, 125, $4, 'pi_123')`,
          [shop.shopId, appt.id, shop.barber.staffId, accountId],
        ),
      );

    await insertCharge();
    expect(await errorCode(insertCharge())).toBe("23505"); // duplicate webhook delivery
    expect(await balance(appt.id)).toEqual({
      paid_cents: 3500,
      tip_cents: 700,
      balance_due_cents: 0,
    });
  });
});

describe("deleting a user who recorded payments", () => {
  it("is allowed, and the ledger keeps who recorded each payment", async () => {
    const shop = await createShop(db.pool);
    const appt = await bookFade(shop);
    await db.asUser(shop.barber.userId, (c) =>
      c.query("SELECT record_manual_payment($1, 'cash')", [appt.id]),
    );

    await db.pool.query("DELETE FROM auth.users WHERE id = $1", [shop.barber.userId]);

    const { rows } = await db.pool.query(
      "SELECT recorded_by FROM payments WHERE appointment_id = $1",
      [appt.id],
    );
    expect(rows[0].recorded_by).toBe(shop.barber.userId);
  });
});
