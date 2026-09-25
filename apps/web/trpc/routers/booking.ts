import { findAvailableSlots, isSlotAvailable } from "@lineup/scheduling";
import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { z } from "zod";
import { getShopBySlug, loadBookingContext } from "@/lib/booking/context";
import { normalizePhone } from "@/lib/booking/phone";
import { localDaysWindow } from "@/lib/booking/time";
import { adminClient } from "@/lib/supabase/admin";
import { textBooking } from "@/lib/sms/notify";
import { unwrap } from "../errors";
import { publicProcedure, router } from "../init";

/** How long a slot is held while the client finishes checkout. */
const HOLD_MINUTES = 10;

/** Sources a client-facing page may claim. Staff and agent sources are set server-side. */
const publicSource = z
  .enum(["booking_link", "website", "instagram", "google", "referral", "other"])
  .default("booking_link");

const slotRequest = z.object({
  shopSlug: z.string().min(1),
  staffId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
});

/**
 * The public booking flow: look up a shop, find open times, hold one, then
 * confirm with the client's details. Clients never sign in, so these run
 * with the admin client and every input is checked here.
 */
export const bookingRouter = router({
  /** A shop's public menu: barbers and the services each one offers. */
  shop: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ input }) => {
    const db = adminClient();
    const shop = await getShopBySlug(db, input.slug);

    const [staff, services, staffServices] = await Promise.all([
      db
        .from("staff")
        .select("id, display_name, slug, bio")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .eq("is_bookable", true)
        .order("sort_order"),
      db
        .from("services")
        .select("id, name, description, duration_minutes, price_cents, deposit_cents, is_addon")
        .eq("shop_id", shop.id)
        .eq("is_active", true)
        .order("sort_order"),
      db
        .from("staff_services")
        .select("staff_id, service_id, price_cents, duration_minutes")
        .eq("shop_id", shop.id),
    ]);

    const offers = unwrap(staffServices);
    return {
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        timezone: shop.timezone,
        brandColor: shop.brand_color,
        /** The website template, so the booking page can match it. */
        template: shop.site_template,
      },
      barbers: unwrap(staff).map((s) => ({
        id: s.id,
        name: s.display_name,
        slug: s.slug,
        bio: s.bio,
      })),
      services: unwrap(services).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.duration_minutes,
        priceCents: s.price_cents,
        depositCents: s.deposit_cents,
        isAddon: s.is_addon,
        // Which barbers offer it, and at what price/duration if they differ.
        offeredBy: offers
          .filter((o) => o.service_id === s.id)
          .map((o) => ({
            staffId: o.staff_id,
            priceCents: o.price_cents ?? s.price_cents,
            durationMinutes: o.duration_minutes ?? s.duration_minutes,
          })),
      })),
    };
  }),

  /** Open start times for a barber and set of services, over whole local days. */
  availability: publicProcedure
    .input(
      slotRequest.extend({
        date: z.string().date(),
        days: z.number().int().min(1).max(14).default(1),
      }),
    )
    .query(async ({ input }) => {
      const db = adminClient();
      const shop = await getShopBySlug(db, input.shopSlug);
      const window = localDaysWindow(input.date, input.days, shop.timezone);
      const ctx = await loadBookingContext(db, { ...input, window, now: new Date() });

      const slots = findAvailableSlots({ ...ctx.schedule, from: window.start, to: window.end });
      return {
        timezone: shop.timezone,
        durationMinutes: ctx.summary.durationMinutes,
        priceCents: ctx.summary.priceCents,
        depositCents: ctx.summary.depositCents,
        slots: slots.map((s) => s.toISOString()),
      };
    }),

  /** Reserves a slot for a few minutes while the client enters their details. */
  hold: publicProcedure
    .input(
      slotRequest.extend({ startsAt: z.string().datetime({ offset: true }), source: publicSource }),
    )
    .mutation(async ({ input }) => {
      const db = adminClient();
      const startsAt = new Date(input.startsAt);
      const window = {
        start: new Date(startsAt.getTime() - 86_400_000),
        end: new Date(startsAt.getTime() + 86_400_000),
      };
      const ctx = await loadBookingContext(db, { ...input, window, now: new Date() });

      if (!isSlotAvailable(ctx.schedule, startsAt)) {
        throw new TRPCError({ code: "CONFLICT", message: "That time is no longer available." });
      }

      const appointment = unwrap(
        await db.rpc("create_appointment", {
          p_shop_id: ctx.shop.id,
          p_staff_id: input.staffId,
          p_starts_at: startsAt.toISOString(),
          p_service_ids: input.serviceIds,
          p_source: input.source,
          p_booked_by: "client",
          p_hold_minutes: HOLD_MINUTES,
        }),
      );

      return {
        appointmentId: appointment.id,
        holdExpiresAt: appointment.hold_expires_at,
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
        priceCents: appointment.total_price_cents,
        depositCents: appointment.deposit_cents,
      };
    }),

  /**
   * Confirms a held slot with the client's details. Returning clients are
   * matched by phone number within the shop, keeping the barber's notes.
   *
   * Deposits aren't collected yet: that arrives with Stripe. Until then the
   * booking confirms and any deposit is settled in the shop.
   */
  confirm: publicProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        name: z.string().trim().min(1).max(100),
        phone: z.string().transform((value, ctx) => {
          const phone = normalizePhone(value);
          if (!phone) {
            ctx.addIssue({ code: "custom", message: "Enter a valid phone number." });
            return z.NEVER;
          }
          return phone;
        }),
        email: z.string().trim().email().max(254).optional(),
        smsConsent: z.boolean(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = adminClient();

      const hold = unwrap(
        await db
          .from("appointments")
          .select("id, shop_id, status")
          .eq("id", input.appointmentId)
          .maybeSingle(),
      );
      if (!hold || hold.status !== "held") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This hold has expired. Please pick a time again.",
        });
      }

      const now = new Date().toISOString();
      const existing = unwrap(
        await db
          .from("clients")
          .select("id, sms_consent_at, email")
          .eq("shop_id", hold.shop_id)
          .eq("phone", input.phone)
          .maybeSingle(),
      );

      let clientId: string;
      if (existing) {
        clientId = existing.id;
        unwrap(
          await db
            .from("clients")
            .update({
              email: existing.email ?? input.email ?? null,
              sms_consent_at: existing.sms_consent_at ?? (input.smsConsent ? now : null),
            })
            .eq("id", existing.id),
        );
      } else {
        const created = unwrap(
          await db
            .from("clients")
            .insert({
              shop_id: hold.shop_id,
              phone: input.phone,
              name: input.name,
              email: input.email ?? null,
              sms_consent_at: input.smsConsent ? now : null,
            })
            .select("id")
            .single(),
        );
        clientId = created.id;
      }

      if (input.note) {
        unwrap(await db.from("appointments").update({ client_note: input.note }).eq("id", hold.id));
      }

      const appointment = unwrap(
        await db.rpc("confirm_hold", { p_appointment_id: hold.id, p_client_id: clientId }),
      );

      // Text the confirmation after responding, so the client never waits on it.
      after(() => textBooking(appointment.id, "confirmation"));

      return {
        appointmentId: appointment.id,
        status: appointment.status,
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
        priceCents: appointment.total_price_cents,
        depositCents: appointment.deposit_cents,
      };
    }),
});
