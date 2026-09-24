import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/booking/phone";
import { unwrap } from "../errors";
import { router, shopProcedure } from "../init";

const phone = z.string().transform((value, ctx) => {
  const e164 = normalizePhone(value);
  if (!e164) {
    ctx.addIssue({ code: "custom", message: "Enter a valid phone number." });
    return z.NEVER;
  }
  return e164;
});

const clientFields = z.object({
  name: z.string().trim().min(1).max(100),
  phone,
  email: z.string().trim().toLowerCase().email().max(254).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  preferredStaffId: z.string().uuid().nullable(),
});

/** Strips characters that would break a PostgREST `or` filter. */
function searchTerm(input: string): string {
  return input.replace(/[,()*%\\]/g, " ").trim();
}

export const clientsRouter = router({
  /** Clients the viewer can see (RLS), with visit stats. */
  list: shopProcedure
    .input(z.object({ search: z.string().max(100).optional() }))
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from("clients")
        .select("id, name, phone, email, preferred_staff_id")
        .eq("shop_id", ctx.shopId)
        .order("name")
        .limit(300);

      const term = searchTerm(input.search ?? "");
      if (term) {
        const digits = term.replace(/\D/g, "");
        query = query.or(
          [
            `name.ilike.*${term}*`,
            `email.ilike.*${term}*`,
            ...(digits.length >= 3 ? [`phone.like.*${digits}*`] : []),
          ].join(","),
        );
      }
      const clients = unwrap(await query);
      const ids = clients.map((c) => c.id);
      const stats = ids.length
        ? unwrap(await ctx.supabase.from("client_stats").select("*").in("client_id", ids))
        : [];

      return clients.map((c) => {
        const s = stats.find((x) => x.client_id === c.id);
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          preferredStaffId: c.preferred_staff_id,
          visits: s?.visits ?? 0,
          lastVisitAt: s?.last_visit_at ?? null,
          nextVisitAt: s?.next_visit_at ?? null,
          spentCents: s?.spent_cents ?? 0,
        };
      });
    }),

  detail: shopProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [client, stats, appointments, staff] = await Promise.all([
        ctx.supabase
          .from("clients")
          .select("id, name, phone, email, notes, preferred_staff_id, sms_consent_at, created_at")
          .eq("shop_id", ctx.shopId)
          .eq("id", input.clientId)
          .maybeSingle(),
        ctx.supabase.from("client_stats").select("*").eq("client_id", input.clientId).maybeSingle(),
        ctx.supabase
          .from("appointments")
          .select("id, staff_id, status, starts_at, total_price_cents, source")
          .eq("client_id", input.clientId)
          .not("status", "in", "(held,expired)")
          .order("starts_at", { ascending: false })
          .limit(50),
        ctx.supabase
          .from("staff")
          .select("id, display_name, is_active")
          .eq("shop_id", ctx.shopId)
          .order("sort_order"),
      ]);
      const c = unwrap(client);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });

      const appts = unwrap(appointments);
      const items = appts.length
        ? unwrap(
            await ctx.supabase
              .from("appointment_services")
              .select("appointment_id, name, is_addon")
              .in(
                "appointment_id",
                appts.map((a) => a.id),
              ),
          )
        : [];
      const staffRows = unwrap(staff);
      const s = unwrap(stats);

      return {
        client: {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          notes: c.notes,
          preferredStaffId: c.preferred_staff_id,
          textsAllowed: c.sms_consent_at !== null,
          since: c.created_at,
        },
        stats: {
          visits: s?.visits ?? 0,
          noShows: s?.no_shows ?? 0,
          spentCents: s?.spent_cents ?? 0,
          lastVisitAt: s?.last_visit_at ?? null,
          nextVisitAt: s?.next_visit_at ?? null,
        },
        barbers: staffRows
          .filter((b) => b.is_active)
          .map((b) => ({ id: b.id, name: b.display_name })),
        history: appts.map((a) => ({
          id: a.id,
          startsAt: a.starts_at,
          status: a.status,
          priceCents: a.total_price_cents,
          source: a.source,
          barber: staffRows.find((b) => b.id === a.staff_id)?.display_name ?? "—",
          services: items
            .filter((i) => i.appointment_id === a.id)
            .sort((x, y) => Number(x.is_addon) - Number(y.is_addon))
            .map((i) => i.name),
        })),
      };
    }),

  create: shopProcedure.input(clientFields).mutation(async ({ ctx, input }) => {
    const created = await ctx.supabase
      .from("clients")
      .insert({
        shop_id: ctx.shopId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        notes: input.notes,
        preferred_staff_id: input.preferredStaffId,
      })
      .select("id")
      .single();
    if (created.error?.code === "23505") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A client with that phone number already exists.",
      });
    }
    return { id: unwrap(created).id };
  }),

  update: shopProcedure
    .input(clientFields.extend({ clientId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.supabase
        .from("clients")
        .update({
          name: input.name,
          phone: input.phone,
          email: input.email,
          notes: input.notes,
          preferred_staff_id: input.preferredStaffId,
        })
        .eq("id", input.clientId)
        .eq("shop_id", ctx.shopId)
        .select("id")
        .maybeSingle();
      if (updated.error?.code === "23505") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Another client already has that phone number.",
        });
      }
      if (!unwrap(updated))
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
      return { ok: true };
    }),
});
