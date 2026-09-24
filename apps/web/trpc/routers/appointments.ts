import { z } from "zod";
import { unwrap } from "../errors";
import { authedProcedure, router } from "../init";

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
});
