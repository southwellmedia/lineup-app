import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { unwrap } from "../errors";
import { authedProcedure, router } from "../init";

const byId = z.object({ appointmentId: z.string().uuid() });

/** Staff-side appointment actions. RLS decides which appointments each person can touch. */
export const appointmentsRouter = router({
  /**
   * Marks a booking paid in cash or off-platform (Cash App, Zelle...).
   * Leave the amount out to record whatever is still owed. Card payments
   * are recorded by Stripe, never through here.
   */
  markPaid: authedProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        method: z.enum(["cash", "external"]),
        amountCents: z.number().int().min(0).optional(),
        tipCents: z.number().int().min(0).default(0),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = unwrap(
        await ctx.supabase.rpc("record_manual_payment", {
          p_appointment_id: input.appointmentId,
          p_method: input.method,
          p_amount_cents: input.amountCents,
          p_tip_cents: input.tipCents,
          p_note: input.note,
        }),
      );
      return {
        paymentId: payment.id,
        amountCents: payment.amount_cents,
        tipCents: payment.tip_cents,
      };
    }),

  /** The client has arrived. Only a confirmed appointment can be checked in. */
  checkIn: authedProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const row = unwrap(
      await ctx.supabase
        .from("appointments")
        .update({ status: "checked_in" })
        .eq("id", input.appointmentId)
        .eq("status", "confirmed")
        .select("id")
        .maybeSingle(),
    );
    if (!row)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only confirmed appointments can be checked in.",
      });
    return { ok: true };
  }),

  /** The client didn't show. Only once the start time has passed. */
  markNoShow: authedProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const row = unwrap(
      await ctx.supabase
        .from("appointments")
        .update({ status: "no_show" })
        .eq("id", input.appointmentId)
        .in("status", ["confirmed", "checked_in"])
        .lte("starts_at", new Date().toISOString())
        .select("id")
        .maybeSingle(),
    );
    if (!row) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can mark a no-show once the appointment has started.",
      });
    }
    return { ok: true };
  }),

  /**
   * The shop cancels. Visibility is checked under RLS first, then the
   * cancellation runs through the database function (server only).
   */
  cancel: authedProcedure
    .input(byId.extend({ reason: z.string().trim().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      const visible = unwrap(
        await ctx.supabase
          .from("appointments")
          .select("id")
          .eq("id", input.appointmentId)
          .maybeSingle(),
      );
      if (!visible) throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found." });

      unwrap(
        await adminClient().rpc("cancel_appointment", {
          p_appointment_id: input.appointmentId,
          p_cancelled_by: "shop",
          p_reason: input.reason,
        }),
      );
      return { ok: true };
    }),
});
