import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parseTstzRange } from "@/lib/booking/time";
import { slugify, uniqueSlug } from "@/lib/shop/slug";
import { unwrap } from "../errors";
import { managerProcedure, router, shopProcedure } from "../init";

const role = z.enum(["owner", "manager", "barber"]);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const teamRouter = router({
  list: shopProcedure.query(async ({ ctx }) => {
    const [staff, hours] = await Promise.all([
      ctx.supabase
        .from("staff")
        .select("id, display_name, email, phone, role, is_active, is_bookable, user_id, sort_order")
        .eq("shop_id", ctx.shopId)
        .order("is_active", { ascending: false })
        .order("sort_order")
        .order("display_name"),
      ctx.supabase.from("working_hours").select("staff_id, weekday").eq("shop_id", ctx.shopId),
    ]);
    const hourRows = unwrap(hours);
    return unwrap(staff).map((s) => ({
      id: s.id,
      name: s.display_name,
      email: s.email,
      phone: s.phone,
      role: s.role,
      isActive: s.is_active,
      isBookable: s.is_bookable,
      /** Invited but hasn't signed in yet. */
      pending: s.user_id === null,
      daysWorked: [
        ...new Set(hourRows.filter((h) => h.staff_id === s.id).map((h) => h.weekday)),
      ].sort(),
    }));
  }),

  /** One barber's profile, weekly hours and upcoming time off. Barbers can open only their own. */
  detail: shopProcedure
    .input(z.object({ staffId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const isManager = ctx.staff.role === "owner" || ctx.staff.role === "manager";
      if (!isManager && input.staffId !== ctx.staff.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only manage your own schedule.",
        });
      }
      const [staff, hours, timeOff] = await Promise.all([
        ctx.supabase
          .from("staff")
          .select("id, display_name, email, phone, bio, role, is_active, is_bookable, user_id")
          .eq("shop_id", ctx.shopId)
          .eq("id", input.staffId)
          .maybeSingle(),
        ctx.supabase
          .from("working_hours")
          .select("weekday, start_time, end_time")
          .eq("staff_id", input.staffId)
          .order("weekday")
          .order("start_time"),
        ctx.supabase
          .from("time_off")
          .select("id, during, reason")
          .eq("staff_id", input.staffId)
          .overlaps("during", `[${new Date().toISOString()},infinity)`),
      ]);
      const s = unwrap(staff);
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });
      return {
        canManage: isManager,
        staff: {
          id: s.id,
          name: s.display_name,
          email: s.email,
          phone: s.phone,
          bio: s.bio,
          role: s.role,
          isActive: s.is_active,
          isBookable: s.is_bookable,
          pending: s.user_id === null,
        },
        hours: unwrap(hours).map((h) => ({
          weekday: h.weekday,
          start: h.start_time.slice(0, 5),
          end: h.end_time.slice(0, 5),
        })),
        timeOff: unwrap(timeOff)
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
          })
          .sort((a, b) => a.start.localeCompare(b.start)),
      };
    }),

  /**
   * Adds someone to the team. They get access the first time they sign in
   * with this email (see claim_staff_invites).
   */
  invite: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        email: z.string().trim().toLowerCase().email(),
        role,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.role === "owner" && ctx.staff.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner can add another owner." });
      }
      const existing = unwrap(
        await ctx.supabase.from("staff").select("slug, email").eq("shop_id", ctx.shopId),
      );
      if (existing.some((s) => s.email?.toLowerCase() === input.email)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Someone on the team already has that email.",
        });
      }
      const created = unwrap(
        await ctx.supabase
          .from("staff")
          .insert({
            shop_id: ctx.shopId,
            display_name: input.name,
            email: input.email,
            role: input.role,
            slug: uniqueSlug(
              slugify(input.name),
              existing.map((s) => s.slug),
            ),
            sort_order: existing.length,
          })
          .select("id")
          .single(),
      );
      return { id: created.id };
    }),

  update: managerProcedure
    .input(
      z.object({
        staffId: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        email: z.string().trim().toLowerCase().email().nullable(),
        phone: z.string().trim().max(30).nullable(),
        bio: z.string().trim().max(300).nullable(),
        role,
        isBookable: z.boolean(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const team = unwrap(
        await ctx.supabase.from("staff").select("id, role, is_active").eq("shop_id", ctx.shopId),
      );
      const target = team.find((s) => s.id === input.staffId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Team member not found." });

      const touchesOwner = target.role === "owner" || input.role === "owner";
      if (touchesOwner && ctx.staff.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner can change an owner." });
      }
      const ownersAfter = team.filter((s) =>
        s.id === input.staffId
          ? input.role === "owner" && input.isActive
          : s.role === "owner" && s.is_active,
      ).length;
      if (ownersAfter === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A shop needs at least one active owner.",
        });
      }

      unwrap(
        await ctx.supabase
          .from("staff")
          .update({
            display_name: input.name,
            email: input.email,
            phone: input.phone,
            bio: input.bio,
            role: input.role,
            is_bookable: input.isBookable,
            is_active: input.isActive,
          })
          .eq("id", input.staffId),
      );
      return { ok: true };
    }),

  /** Replaces a barber's weekly hours. The barber or a manager can do this (RLS). */
  setHours: shopProcedure
    .input(
      z.object({
        staffId: z.string().uuid(),
        hours: z
          .array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }))
          .max(50)
          .refine(
            (rows) => rows.every((r) => r.end > r.start),
            "Each block must end after it starts.",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      unwrap(
        await ctx.supabase.rpc("set_working_hours", {
          p_staff_id: input.staffId,
          p_hours: input.hours.map((h) => ({
            weekday: h.weekday,
            start_time: h.start,
            end_time: h.end,
          })),
        }),
      );
      return { ok: true };
    }),

  addTimeOff: shopProcedure
    .input(
      z
        .object({
          staffId: z.string().uuid(),
          start: z.string().datetime({ offset: true }),
          end: z.string().datetime({ offset: true }),
          reason: z.string().trim().max(120).optional(),
        })
        .refine((t) => new Date(t.end) > new Date(t.start), {
          message: "End must be after start.",
          path: ["end"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      unwrap(
        await ctx.supabase.from("time_off").insert({
          shop_id: ctx.shopId,
          staff_id: input.staffId,
          during: `[${new Date(input.start).toISOString()},${new Date(input.end).toISOString()})`,
          reason: input.reason ?? null,
        }),
      );
      return { ok: true };
    }),

  removeTimeOff: shopProcedure
    .input(z.object({ timeOffId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      unwrap(
        await ctx.supabase
          .from("time_off")
          .delete()
          .eq("id", input.timeOffId)
          .eq("shop_id", ctx.shopId),
      );
      return { ok: true };
    }),
});
