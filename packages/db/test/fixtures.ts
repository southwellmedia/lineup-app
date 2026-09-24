import { randomUUID } from "node:crypto";
import type pg from "pg";

export type ShopFixture = {
  shopId: string;
  owner: { userId: string; staffId: string };
  barber: { userId: string; staffId: string };
  otherBarber: { userId: string; staffId: string };
  services: { fade: string; beard: string; lineup: string };
  clientId: string;
};

async function one<T extends pg.QueryResultRow>(
  pool: pg.Pool,
  sql: string,
  params: unknown[],
): Promise<T> {
  const { rows } = await pool.query<T>(sql, params);
  const row = rows[0];
  if (!row) throw new Error(`Fixture query returned no rows: ${sql}`);
  return row;
}

async function createUser(pool: pg.Pool): Promise<string> {
  const row = await one<{ id: string }>(
    pool,
    "INSERT INTO auth.users (email) VALUES ($1) RETURNING id",
    [`${randomUUID()}@example.test`],
  );
  return row.id;
}

async function createStaff(
  pool: pg.Pool,
  shopId: string,
  role: "owner" | "manager" | "barber",
  name: string,
): Promise<{ userId: string; staffId: string }> {
  const userId = await createUser(pool);
  const row = await one<{ id: string }>(
    pool,
    `INSERT INTO public.staff (shop_id, user_id, role, display_name, slug)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [shopId, userId, role, name, name.toLowerCase().replaceAll(" ", "-")],
  );
  return { userId, staffId: row.id };
}

/**
 * A three-person shop: an owner who also cuts, and two barbers. Everyone
 * offers a 30-minute fade ($35, $10 deposit, 5-minute buffer), a 15-minute
 * beard add-on ($15) and a 15-minute lineup ($20).
 */
export async function createShop(pool: pg.Pool, slug = `shop-${randomUUID().slice(0, 8)}`) {
  const shop = await one<{ id: string }>(
    pool,
    `INSERT INTO public.shops (name, slug, plan, timezone)
     VALUES ($1, $2, 'shop', 'America/Chicago') RETURNING id`,
    [`Shop ${slug}`, slug],
  );
  const shopId = shop.id;

  const owner = await createStaff(pool, shopId, "owner", "Owner");
  const barber = await createStaff(pool, shopId, "barber", "Marcus");
  const otherBarber = await createStaff(pool, shopId, "barber", "Andre");

  const service = async (
    name: string,
    duration: number,
    price: number,
    deposit: number,
    buffer: number,
    isAddon: boolean,
  ) =>
    (
      await one<{ id: string }>(
        pool,
        `INSERT INTO public.services
           (shop_id, name, duration_minutes, price_cents, deposit_cents, buffer_after_minutes, is_addon)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [shopId, name, duration, price, deposit, buffer, isAddon],
      )
    ).id;

  const services = {
    fade: await service("Fade", 30, 3500, 1000, 5, false),
    beard: await service("Beard", 15, 1500, 0, 0, true),
    lineup: await service("Lineup", 15, 2000, 0, 0, false),
  };

  for (const staff of [owner, barber, otherBarber]) {
    for (const serviceId of Object.values(services)) {
      await pool.query(
        "INSERT INTO public.staff_services (shop_id, staff_id, service_id) VALUES ($1, $2, $3)",
        [shopId, staff.staffId, serviceId],
      );
    }
  }

  const client = await createClient(pool, shopId, "+12145550100", "Jordan");

  return { shopId, owner, barber, otherBarber, services, clientId: client } satisfies ShopFixture;
}

export async function createClient(
  pool: pg.Pool,
  shopId: string,
  phone: string,
  name: string,
  preferredStaffId: string | null = null,
): Promise<string> {
  const row = await one<{ id: string }>(
    pool,
    `INSERT INTO public.clients (shop_id, phone, name, preferred_staff_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [shopId, phone, name, preferredStaffId],
  );
  return row.id;
}

export type BookingArgs = {
  shopId: string;
  staffId: string;
  startsAt: string;
  serviceIds: string[];
  clientId?: string | null;
  holdMinutes?: number | null;
  source?: string;
  bookedBy?: string;
};

export type AppointmentRow = {
  id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  blocked_until: Date;
  hold_expires_at: Date | null;
  total_price_cents: number;
  deposit_cents: number;
  client_id: string | null;
};

/** Calls create_appointment with the given client (any role) and returns the new row. */
export async function book(client: pg.ClientBase, args: BookingArgs): Promise<AppointmentRow> {
  const { rows } = await client.query<AppointmentRow>(
    `SELECT * FROM public.create_appointment(
       p_shop_id => $1, p_staff_id => $2, p_starts_at => $3, p_service_ids => $4,
       p_source => $5, p_booked_by => $6, p_client_id => $7, p_hold_minutes => $8)`,
    [
      args.shopId,
      args.staffId,
      args.startsAt,
      args.serviceIds,
      args.source ?? "booking_link",
      args.bookedBy ?? "client",
      args.clientId ?? null,
      args.holdMinutes ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("create_appointment returned no row");
  return row;
}
