import { workingWindows } from "@lineup/scheduling";
import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/booking/phone";
import { localDaysWindow, parseTstzRange, toHourMinute } from "@/lib/booking/time";
import { adminClient } from "@/lib/supabase/admin";
import { textBooking } from "@/lib/sms/notify";
import { unwrap } from "../errors";
import { router, shopProcedure } from "../init";

/** Where a booking made by staff came from. Online sources are set by the booking pages. */
export const STAFF_SOURCES = [
  "walk_in",
  "phone",
  "instagram",
  "google",
  "referral",
  "other",
] as const;

/** On the calendar: live bookings plus no-shows (they don't hold the chair). */
const SHOWN = ["confirmed", "checked_in", "completed", "no_show"] as const;

const isManagerRole = (role: string) => role === "owner" || role === "manager";

export const calendarRouter = router({
  /**
   * Everything the calendar draws for `days` local days from `start`: each
   * bookable barber's working windows and time off, and the appointments
   * the viewer can see (RLS: barbers see only their own chair).
   */
  range: shopProcedure
    .input(z.object({ start: z.string().date(), days: z.number().int().min(1).max(7) }))
    .query(async ({ ctx, input }) => {
      const shop = unwrap(
        await ctx.supabase
          .from("shops")
          .select("id, timezone, slot_interval_minutes")
          .eq("id", ctx.shopId)
          .maybeSingle(),
      );
      if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

      const window = localDaysWindow(input.start, input.days, shop.timezone);
      const from = window.start.toISOString();
      const to = window.end.toISOString();

      const [staff, hours, timeOff, appointments] = await Promise.all([
        ctx.supabase
          .from("staff")
          .select("id, display_name, role, is_bookable")
          .eq("shop_id", ctx.shopId)
          .eq("is_active", true)
          .order("sort_order"),
        ctx.supabase
          .from("working_hours")
          .select("staff_id, weekday, start_time, end_time")
          .eq("shop_id", ctx.shopId),
        ctx.supabase
          .from("time_off")
          .select("id, staff_id, during, reason")
          .eq("shop_id", ctx.shopId)
          .overlaps("during", `[${from},${to})`),
        ctx.supabase
          .from("appointments")
          .select(
            "id, staff_id, client_id, status, starts_at, ends_at, checked_in_at, source, client_note, total_price_cents",
          )
          .eq("shop_id", ctx.shopId)
          .lt("starts_at", to)
          .gt("ends_at", from)
          .in("status", [...SHOWN])
          .order("starts_at"),
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
          ? ctx.supabase.from("clients").select("id, name, phone").in("id", clientIds)
          : null,
        ids.length
          ? ctx.supabase
              .from("appointment_balances")
              .select("appointment_id, balance_due_cents, paid_cents")
              .in("appointment_id", ids)
          : null,
      ]);
      const itemRows = items ? unwrap(items) : [];
      const clientRows = clients ? unwrap(clients) : [];
      const balanceRows = balances ? unwrap(balances) : [];
      const hourRows = unwrap(hours);

      const barbers = unwrap(staff).filter((s) => s.is_bookable);
      const visible = isManagerRole(ctx.staff.role)
        ? barbers
        : barbers.filter((s) => s.id === ctx.staff.id);

      return {
        timezone: shop.timezone,
        slotMinutes: shop.slot_interval_minutes,
        viewer: { staffId: ctx.staff.id, isManager: isManagerRole(ctx.staff.role) },
        barbers: visible.map((s) => ({
          id: s.id,
          name: s.display_name,
          working: workingWindows(
            shop.timezone,
            hourRows
              .filter((h) => h.staff_id === s.id)
              .map((h) => ({
                weekday: h.weekday,
                start: toHourMinute(h.start_time),
                end: toHourMinute(h.end_time),
              })),
            window.start,
            window.end,
          ).map((w) => ({ start: w.start.toISOString(), end: w.end.toISOString() })),
          timeOff: unwrap(timeOff)
            .filter((t) => t.staff_id === s.id)
            .flatMap((t) => {
              const range = parseTstzRange(t.during);
              return range
                ? [
                    {
                      id: t.id,
                      start: range.start.toISOString(),
                      end: range.end.toISOString(),
                      reason: t.reason,
                    },
                  ]
                : [];
            }),
        })),
        appointments: rows.map((a) => {
          const client = clientRows.find((c) => c.id === a.client_id);
          const balance = balanceRows.find((b) => b.appointment_id === a.id);
          return {
            id: a.id,
            staffId: a.staff_id,
            status: a.status,
            startsAt: a.starts_at,
            endsAt: a.ends_at,
            checkedInAt: a.checked_in_at,
            priceCents: a.total_price_cents,
            paid: (balance?.paid_cents ?? 0) > 0 && (balance?.balance_due_cents ?? 1) <= 0,
            source: a.source,
            note: a.client_note,
            client: client ? { name: client.name, phone: client.phone } : null,
            services: itemRows
              .filter((i) => i.appointment_id === a.id)
              .sort((x, y) => Number(x.is_addon) - Number(y.is_addon))
              .map((i) => i.name),
          };
        }),
      };
    }),

  /**
   * Books a client from the shop side: a phone call, a DM or a walk-in.
   * Staff can book outside working hours; the database still refuses to
   * double-book. Barbers can only book their own chair.
   */
  book: shopProcedure
    .input(
      z.object({
        staffId: z.string().uuid(),
        startsAt: z.string().datetime({ offset: true }),
        serviceIds: z.array(z.string().uuid()).min(1).max(10),
        client: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("existing"), id: z.string().uuid() }),
          z.object({
            kind: z.literal("new"),
            name: z.string().trim().min(1).max(100),
            phone: z.string().trim().max(30),
          }),
        ]),
        source: z.enum(STAFF_SOURCES),
        note: z.string().trim().max(500).optional(),
        checkIn: z.boolean().default(false),
        /** The client said yes to booking texts (recorded as consent). */
        textsOk: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isManagerRole(ctx.staff.role) && input.staffId !== ctx.staff.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only book your own chair." });
      }
      const db = adminClient();

      let clientId: string;
      if (input.client.kind === "existing") {
        // Must be a client this staff member can see.
        const visible = unwrap(
          await ctx.supabase
            .from("clients")
            .select("id")
            .eq("shop_id", ctx.shopId)
            .eq("id", input.client.id)
            .maybeSingle(),
        );
        if (!visible) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found." });
        clientId = visible.id;
      } else {
        const raw = input.client.phone;
        const phone = raw ? normalizePhone(raw) : null;
        if (raw && !phone) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a valid phone number." });
        }
        if (!phone && input.source !== "walk_in") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Add a phone number, or book this as a walk-in.",
          });
        }
        const existing = phone
          ? unwrap(
              await db
                .from("clients")
                .select("id")
                .eq("shop_id", ctx.shopId)
                .eq("phone", phone)
                .maybeSingle(),
            )
          : null;
        clientId =
          existing?.id ??
          unwrap(
            await db
              .from("clients")
              .insert({ shop_id: ctx.shopId, name: input.client.name, phone })
              .select("id")
              .single(),
          ).id;
      }

      if (input.textsOk) {
        unwrap(
          await db
            .from("clients")
            .update({ sms_consent_at: new Date().toISOString() })
            .eq("id", clientId)
            .is("sms_consent_at", null),
        );
      }

      const appointment = unwrap(
        await db.rpc("create_appointment", {
          p_shop_id: ctx.shopId,
          p_staff_id: input.staffId,
          p_starts_at: input.startsAt,
          p_service_ids: input.serviceIds,
          p_source: input.source,
          p_booked_by: "staff",
          p_client_id: clientId,
          p_client_note: input.note || undefined,
        }),
      );

      if (input.checkIn) {
        unwrap(
          await db
            .from("appointments")
            .update({ status: "checked_in" })
            .eq("id", appointment.id)
            .eq("status", "confirmed"),
        );
      }
      // Walk-ins in the chair don't need a confirmation text.
      if (!input.checkIn) after(() => textBooking(appointment.id, "confirmation"));
      return { appointmentId: appointment.id };
    }),

  /** Moves a confirmed booking to another time or barber. */
  reschedule: shopProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        startsAt: z.string().datetime({ offset: true }),
        staffId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appointment = unwrap(
        await ctx.supabase
          .from("appointments")
          .select("id, staff_id")
          .eq("shop_id", ctx.shopId)
          .eq("id", input.appointmentId)
          .maybeSingle(),
      );
      if (!appointment)
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found." });
      if (
        !isManagerRole(ctx.staff.role) &&
        (appointment.staff_id !== ctx.staff.id || input.staffId !== ctx.staff.id)
      ) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only move your own bookings." });
      }

      unwrap(
        await adminClient().rpc("reschedule_appointment", {
          p_appointment_id: input.appointmentId,
          p_starts_at: input.startsAt,
          p_staff_id: input.staffId,
        }),
      );
      return { ok: true };
    }),

  /**
   * Everything the side panel shows for one booking: services and prices,
   * payments, and the client's history with the shop. RLS decides access.
   */
  appointment: shopProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const a = unwrap(
        await ctx.supabase
          .from("appointments")
          .select(
            "id, staff_id, client_id, status, starts_at, ends_at, checked_in_at, completed_at, source, booked_by, total_price_cents, deposit_cents, client_note, created_at, client_confirmed_at",
          )
          .eq("shop_id", ctx.shopId)
          .eq("id", input.appointmentId)
          .maybeSingle(),
      );
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found." });

      const [items, balance, client, stats, texts] = await Promise.all([
        ctx.supabase
          .from("appointment_services")
          .select("service_id, name, duration_minutes, price_cents, is_addon")
          .eq("appointment_id", a.id),
        ctx.supabase
          .from("appointment_balances")
          .select("paid_cents, tip_cents, balance_due_cents")
          .eq("appointment_id", a.id)
          .maybeSingle(),
        a.client_id
          ? ctx.supabase
              .from("clients")
              .select("id, name, phone, email, notes, created_at")
              .eq("id", a.client_id)
              .maybeSingle()
          : null,
        a.client_id
          ? ctx.supabase
              .from("client_stats")
              .select("visits, no_shows, spent_cents, last_visit_at")
              .eq("client_id", a.client_id)
              .maybeSingle()
          : null,
        ctx.supabase
          .from("messages")
          .select("id, direction, kind, body, status, error, created_at")
          .eq("appointment_id", a.id)
          .order("created_at"),
      ]);
      const b = unwrap(balance);
      const c = client ? unwrap(client) : null;
      const st = stats ? unwrap(stats) : null;

      return {
        id: a.id,
        staffId: a.staff_id,
        status: a.status,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        checkedInAt: a.checked_in_at,
        completedAt: a.completed_at,
        source: a.source,
        bookedBy: a.booked_by,
        createdAt: a.created_at,
        clientConfirmedAt: a.client_confirmed_at,
        note: a.client_note,
        texts: unwrap(texts).map((m) => ({
          id: m.id,
          direction: m.direction,
          kind: m.kind,
          body: m.body,
          status: m.status,
          error: m.error,
          at: m.created_at,
        })),
        priceCents: a.total_price_cents,
        depositCents: a.deposit_cents,
        paidCents: b?.paid_cents ?? 0,
        tipCents: b?.tip_cents ?? 0,
        balanceDueCents: b?.balance_due_cents ?? a.total_price_cents,
        services: unwrap(items)
          .sort((x, y) => Number(x.is_addon) - Number(y.is_addon))
          .map((i) => ({
            serviceId: i.service_id,
            name: i.name,
            durationMinutes: i.duration_minutes,
            priceCents: i.price_cents,
            isAddon: i.is_addon,
          })),
        client: c
          ? {
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: c.email,
              notes: c.notes,
              since: c.created_at,
              visits: st?.visits ?? 0,
              noShows: st?.no_shows ?? 0,
              spentCents: st?.spent_cents ?? 0,
              lastVisitAt: st?.last_visit_at ?? null,
            }
          : null,
      };
    }),

  /** Live bookings a barber has in a window, e.g. before adding time off over them. */
  conflicts: shopProcedure
    .input(
      z.object({
        staffId: z.string().uuid(),
        start: z.string().datetime({ offset: true }),
        end: z.string().datetime({ offset: true }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = unwrap(
        await ctx.supabase
          .from("appointments")
          .select("id, starts_at, client_id")
          .eq("shop_id", ctx.shopId)
          .eq("staff_id", input.staffId)
          .in("status", ["confirmed", "checked_in"])
          .lt("starts_at", input.end)
          .gt("ends_at", input.start)
          .order("starts_at"),
      );
      const clientIds = [...new Set(rows.flatMap((r) => (r.client_id ? [r.client_id] : [])))];
      const clients = clientIds.length
        ? unwrap(await ctx.supabase.from("clients").select("id, name").in("id", clientIds))
        : [];
      return rows.map((r) => ({
        id: r.id,
        startsAt: r.starts_at,
        clientName: clients.find((c) => c.id === r.client_id)?.name ?? "Client",
      }));
    }),
});
