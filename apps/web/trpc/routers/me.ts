import { unwrap } from "../errors";
import { authedProcedure, router } from "../init";

export const meRouter = router({
  /** The shops the signed-in person works at, and their role in each. */
  shops: authedProcedure.query(async ({ ctx }) => {
    const memberships = unwrap(
      await ctx.supabase
        .from("staff")
        .select("id, role, shop_id")
        .eq("user_id", ctx.userId)
        .eq("is_active", true),
    );
    if (memberships.length === 0) return [];

    const shops = unwrap(
      await ctx.supabase
        .from("shops")
        .select("id, name, slug, plan")
        .in(
          "id",
          memberships.map((m) => m.shop_id),
        ),
    );
    return shops.map((shop) => ({
      ...shop,
      role: memberships.find((m) => m.shop_id === shop.id)?.role ?? "barber",
      staffId: memberships.find((m) => m.shop_id === shop.id)?.id,
    }));
  }),
});
