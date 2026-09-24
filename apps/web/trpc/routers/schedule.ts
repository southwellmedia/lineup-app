import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { localDaysWindow } from "@/lib/booking/time";
import { unwrap } from "../errors";
import { router, shopProcedure } from "../init";

/** Statuses that never reach the staff calendar: abandoned checkouts. */
const HIDDEN = "(held,expired)";

export const scheduleRouter = router({
  /**
   * One local day of a shop's appointments. Runs under RLS, so managers see
   * the whole shop and barbers see only their own chair.
   */
  day: shopProcedure.input(z.object({ date: z.string().date() })).query(async ({ ctx, input }) => {
    const shop = unwrap(
      await ctx.supabase
        .from("shops")
        .select("id, name, slug, timezone, plan")
        .eq("id", ctx.shopId)
        .maybeSingle(),
    );
    if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

    const window = localDaysWindow(input.date, 1, shop.timezone);
    const [appointments, staff] = await Promise.all([
      ctx.supabase
        .from("appointments")
        .select(
          "id, staff_id, client_id, status, starts_at, ends_at, source, booked_by, total_price_cents, deposit_cents, client_note",
        )
        .eq("shop_id", shop.id)
        .gte("starts_at", window.start.toISOString())
        .lt("starts_at", window.end.toISOString())
        .not("status", "in", HIDDEN)
        .order("starts_at"),
      ctx.supabase
        .from("staff")
        .select("id, display_name, role, is_bookable")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    const rows = unwrap(appointments);
    const ids = rows.map((a) => a.id);
    const clientIds = [...new Set(rows.flatMap((a) => (a.client_id ? [a.client_id] : [])))];

    const [items, clients, balances] = await Promise.all([
      ids.length
        ? ctx.supabase
            .from("appointment_services")
            .select("appointment_id, name, is_addon")
            .in("appointment_id", ids)
        : null,
      clientIds.length
        ? ctx.supabase.from("clients").select("id, name, phone, notes").in("id", clientIds)
        : null,
      ids.length
        ? ctx.supabase
            .from("appointment_balances")
            .select("appointment_id, paid_cents, tip_cents, balance_due_cents")
            .in("appointment_id", ids)
        : null,
    ]);
    const itemRows = items ? unwrap(items) : [];
    const clientRows = clients ? unwrap(clients) : [];
    const balanceRows = balances ? unwrap(balances) : [];

    return {
      shop,
      date: input.date,
      viewer: { staffId: ctx.staff.id, role: ctx.staff.role },
      staff: unwrap(staff).map((s) => ({ id: s.id, name: s.display_name, role: s.role })),
      appointments: rows.map((a) => {
        const client = clientRows.find((c) => c.id === a.client_id);
        const balance = balanceRows.find((b) => b.appointment_id === a.id);
        return {
          id: a.id,
          staffId: a.staff_id,
          status: a.status,
          startsAt: a.starts_at,
          endsAt: a.ends_at,
          source: a.source,
          bookedBy: a.booked_by,
          note: a.client_note,
          priceCents: a.total_price_cents,
          services: itemRows
            .filter((i) => i.appointment_id === a.id)
            .sort((x, y) => Number(x.is_addon) - Number(y.is_addon))
            .map((i) => i.name),
          client: client ? { name: client.name, phone: client.phone, notes: client.notes } : null,
          paidCents: balance?.paid_cents ?? 0,
          tipCents: balance?.tip_cents ?? 0,
          balanceDueCents: balance?.balance_due_cents ?? a.total_price_cents,
        };
      }),
    };
  }),
});
