import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/admin/platform";
import { adminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

export async function createContext() {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims.sub ?? null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof z.ZodError ? z.flattenError(error.cause) : null,
    },
  }),
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Level 1: anyone, including clients booking without an account. Public
 * procedures that touch the database use the admin client and must do their
 * own checks, because RLS gives anonymous visitors no access.
 */
export const publicProcedure = t.procedure;

/** Level 2: a signed-in staff member. RLS applies to ctx.supabase. */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in." });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

/** Level 3: an active member of the shop named in the input. */
export const shopProcedure = authedProcedure
  .input(z.object({ shopId: z.string().uuid() }))
  .use(async ({ ctx, input, next }) => {
    const { data: staff } = await ctx.supabase
      .from("staff")
      .select("id, role")
      .eq("shop_id", input.shopId)
      .eq("user_id", ctx.userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!staff)
      throw new TRPCError({ code: "FORBIDDEN", message: "You're not a member of this shop." });
    return next({ ctx: { ...ctx, shopId: input.shopId, staff } });
  });

/** Level 4: an owner or manager of the shop. */
export const managerProcedure = shopProcedure.use(({ ctx, next }) => {
  if (ctx.staff.role !== "owner" && ctx.staff.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only owners and managers can do that." });
  }
  return next();
});

/**
 * Lineup staff only (the super admin panel). ctx.db bypasses RLS, so every
 * admin procedure works across shops; changes must be recorded with audit().
 */
export const adminProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (!(await isPlatformAdmin(ctx.userId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Lineup admins only." });
  }
  return next({ ctx: { ...ctx, db: adminClient() } });
});
