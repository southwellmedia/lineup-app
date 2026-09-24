import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { unwrap } from "../errors";
import { managerProcedure, router, shopProcedure } from "../init";

const serviceInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(300).nullable(),
    durationMinutes: z.number().int().min(5).max(600),
    bufferAfterMinutes: z.number().int().min(0).max(120),
    priceCents: z.number().int().min(0).max(1_000_000),
    depositCents: z.number().int().min(0).max(1_000_000),
    isAddon: z.boolean(),
    isActive: z.boolean(),
    /** The barbers who offer it, with optional own price or duration. */
    offeredBy: z
      .array(
        z.object({
          staffId: z.string().uuid(),
          priceCents: z.number().int().min(0).max(1_000_000).nullable(),
          durationMinutes: z.number().int().min(5).max(600).nullable(),
        }),
      )
      .max(50),
  })
  .refine((s) => s.depositCents <= s.priceCents, {
    message: "The deposit can't be more than the price.",
    path: ["depositCents"],
  });

export const servicesRouter = router({
  /** The full menu, including archived services, plus who offers what. */
  list: shopProcedure.query(async ({ ctx }) => {
    const [services, offers, staff] = await Promise.all([
      ctx.supabase
        .from("services")
        .select(
          "id, name, description, duration_minutes, buffer_after_minutes, price_cents, deposit_cents, is_addon, is_active, sort_order",
        )
        .eq("shop_id", ctx.shopId)
        .order("sort_order")
        .order("name"),
      ctx.supabase
        .from("staff_services")
        .select("service_id, staff_id, price_cents, duration_minutes")
        .eq("shop_id", ctx.shopId),
      ctx.supabase
        .from("staff")
        .select("id, display_name, is_bookable")
        .eq("shop_id", ctx.shopId)
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    const offerRows = unwrap(offers);
    return {
      barbers: unwrap(staff).map((s) => ({
        id: s.id,
        name: s.display_name,
        isBookable: s.is_bookable,
      })),
      services: unwrap(services).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMinutes: s.duration_minutes,
        bufferAfterMinutes: s.buffer_after_minutes,
        priceCents: s.price_cents,
        depositCents: s.deposit_cents,
        isAddon: s.is_addon,
        isActive: s.is_active,
        offeredBy: offerRows
          .filter((o) => o.service_id === s.id)
          .map((o) => ({
            staffId: o.staff_id,
            priceCents: o.price_cents,
            durationMinutes: o.duration_minutes,
          })),
      })),
    };
  }),

  /** Creates or updates a service and syncs which barbers offer it. */
  save: managerProcedure.input(serviceInput).mutation(async ({ ctx, input }) => {
    const values = {
      name: input.name,
      description: input.description,
      duration_minutes: input.durationMinutes,
      buffer_after_minutes: input.bufferAfterMinutes,
      price_cents: input.priceCents,
      deposit_cents: input.depositCents,
      is_addon: input.isAddon,
      is_active: input.isActive,
    };

    let serviceId: string;
    if (input.id) {
      const updated = unwrap(
        await ctx.supabase
          .from("services")
          .update(values)
          .eq("id", input.id)
          .eq("shop_id", ctx.shopId)
          .select("id")
          .maybeSingle(),
      );
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found." });
      serviceId = updated.id;
    } else {
      const { count } = await ctx.supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", ctx.shopId);
      const created = unwrap(
        await ctx.supabase
          .from("services")
          .insert({ ...values, shop_id: ctx.shopId, sort_order: count ?? 0 })
          .select("id")
          .single(),
      );
      serviceId = created.id;
    }

    // Sync offerings: remove barbers no longer listed, upsert the rest.
    const keep = input.offeredBy.map((o) => o.staffId);
    const remove = ctx.supabase.from("staff_services").delete().eq("service_id", serviceId);
    unwrap(await (keep.length ? remove.not("staff_id", "in", `(${keep.join(",")})`) : remove));
    if (keep.length) {
      unwrap(
        await ctx.supabase.from("staff_services").upsert(
          input.offeredBy.map((o) => ({
            shop_id: ctx.shopId,
            staff_id: o.staffId,
            service_id: serviceId,
            price_cents: o.priceCents,
            duration_minutes: o.durationMinutes,
          })),
          { onConflict: "staff_id,service_id" },
        ),
      );
    }
    return { id: serviceId };
  }),

  /** Moves a service up or down the menu. */
  move: managerProcedure
    .input(z.object({ serviceId: z.string().uuid(), direction: z.enum(["up", "down"]) }))
    .mutation(async ({ ctx, input }) => {
      const rows = unwrap(
        await ctx.supabase
          .from("services")
          .select("id, sort_order")
          .eq("shop_id", ctx.shopId)
          .order("sort_order")
          .order("name"),
      );
      const i = rows.findIndex((r) => r.id === input.serviceId);
      const j = input.direction === "up" ? i - 1 : i + 1;
      const a = rows[i];
      const b = rows[j];
      if (!a || !b) return { ok: true };
      // Renumber everything so ties from older data can't stick.
      const ordered = rows.map((r) => r.id);
      [ordered[i], ordered[j]] = [b.id, a.id];
      await Promise.all(
        ordered.map((id, index) =>
          ctx.supabase.from("services").update({ sort_order: index }).eq("id", id),
        ),
      );
      return { ok: true };
    }),
});
