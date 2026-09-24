import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { useTestDb } from "./db";
import { createShop } from "./fixtures";

const db = useTestDb();

async function newUser(): Promise<string> {
  const { rows } = await db.pool.query<{ id: string }>(
    "INSERT INTO auth.users DEFAULT VALUES RETURNING id",
  );
  const row = rows[0];
  if (!row) throw new Error("no user");
  return row.id;
}

const claim = (userId: string, email: string) =>
  db.asUser(
    userId,
    async (c) => (await c.query<{ n: number }>("SELECT claim_staff_invites() AS n")).rows[0]?.n,
    { email },
  );

describe("claim_staff_invites", () => {
  it("links an invited barber to their login by email, case-insensitively", async () => {
    const shop = await createShop(db.pool);
    const email = `${randomUUID()}@example.test`;
    const { rows } = await db.pool.query<{ id: string }>(
      "INSERT INTO staff (shop_id, display_name, slug, email) VALUES ($1, 'New Barber', 'new-barber', $2) RETURNING id",
      [shop.shopId, email],
    );
    const staffId = rows[0]?.id;

    const user = await newUser();
    expect(await claim(user, email.toUpperCase())).toBe(1);

    const linked = await db.pool.query("SELECT user_id FROM staff WHERE id = $1", [staffId]);
    expect(linked.rows[0].user_id).toBe(user);

    // They can now see their shop, and claiming again is a no-op.
    const shops = await db.asUser(user, (c) => c.query("SELECT id FROM shops"));
    expect(shops.rows.map((r) => r.id)).toEqual([shop.shopId]);
    expect(await claim(user, email)).toBe(0);
  });

  it("never takes over a row that already has a login, or an inactive one", async () => {
    const shop = await createShop(db.pool);
    const email = `${randomUUID()}@example.test`;
    await db.pool.query("UPDATE staff SET email = $1 WHERE id = $2", [email, shop.barber.staffId]);
    await db.pool.query(
      "INSERT INTO staff (shop_id, display_name, slug, email, is_active) VALUES ($1, 'Gone', 'gone', $2, false)",
      [shop.shopId, email],
    );

    const intruder = await newUser();
    expect(await claim(intruder, email)).toBe(0);
    const { rows } = await db.pool.query("SELECT user_id FROM staff WHERE id = $1", [
      shop.barber.staffId,
    ]);
    expect(rows[0].user_id).toBe(shop.barber.userId);
  });

  it("does nothing without a verified email claim", async () => {
    const user = await newUser();
    expect(
      await db.asUser(
        user,
        async (c) => (await c.query("SELECT claim_staff_invites() AS n")).rows[0].n,
      ),
    ).toBe(0);
  });

  it("is not callable anonymously", async () => {
    await expect(db.asAnon((c) => c.query("SELECT claim_staff_invites()"))).rejects.toMatchObject({
      code: "42501",
    });
  });
});
