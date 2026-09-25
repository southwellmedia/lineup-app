import type { Database } from "@lineup/db";
import { TEMPLATES, isTemplateId } from "@lineup/site-kit";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { audit } from "@/lib/admin/platform";
import { sitesUrl } from "@/lib/env";
import { shopSiteUrl } from "@/lib/site/overview";
import { smsConfig } from "@/lib/sms/twilio";
import { unwrap } from "../errors";
import { adminProcedure, router } from "../init";

const DAY = 86_400_000;
const since = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const SHOP_COLUMNS =
  "id, name, slug, plan, timezone, created_at, custom_domain, site_template, premium_templates, suspended_at, suspended_reason, sms_enabled" as const;

type Db = SupabaseClient<Database>;

/** Per-shop activity over the last 30 days, keyed by shop id. */
async function shopStats(db: Db) {
  const rows = unwrap(await db.rpc("admin_shop_stats", { p_since: since(30) }));
  return new Map(rows.map((r) => [r.shop_id, r]));
}

/** Owners' names and emails, keyed by shop id. */
async function owners(db: Db, shopIds: string[]) {
  if (!shopIds.length) return new Map<string, { name: string; email: string | null }[]>();
  const rows = unwrap(
    await db
      .from("staff")
      .select("shop_id, display_name, email")
      .eq("role", "owner")
      .eq("is_active", true)
      .in("shop_id", shopIds),
  );
  const map = new Map<string, { name: string; email: string | null }[]>();
  for (const r of rows) {
    map.set(r.shop_id, [...(map.get(r.shop_id) ?? []), { name: r.display_name, email: r.email }]);
  }
  return map;
}

/** Login emails for audit entries. */
async function emails(db: Db, userIds: string[]) {
  const unique = [...new Set(userIds)];
  const found = await Promise.all(
    unique.map(async (id) => [id, (await db.auth.admin.getUserById(id)).data.user?.email ?? null]),
  );
  return new Map(found as [string, string | null][]);
}

const shopInput = z.object({ shopId: z.string().uuid() });

export const adminRouter = router({
  /** Platform health at a glance: shops, activity and texting over 30 days. */
  overview: adminProcedure.query(async ({ ctx }) => {
    const [shops, stats, sources] = await Promise.all([
      ctx.db.from("shops").select("id, name, slug, plan, created_at, suspended_at"),
      shopStats(ctx.db),
      ctx.db.rpc("admin_booking_sources", { p_since: since(30) }),
    ]);
    const list = unwrap(shops);
    const all = [...stats.values()];
    const sum = (key: "bookings" | "booked_cents" | "texts_sent" | "texts_failed" | "site_views") =>
      all.reduce((n, r) => n + Number(r[key]), 0);

    // New shops per week, oldest first, for the last 8 weeks.
    const weekStart = (d: Date) => {
      const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
      return x.getTime();
    };
    const thisWeek = weekStart(new Date());
    const signups = Array.from({ length: 8 }, (_, i) => {
      const start = thisWeek - (7 - i) * 7 * DAY;
      return {
        week: new Date(start).toISOString().slice(0, 10),
        shops: list.filter((s) => weekStart(new Date(s.created_at)) === start).length,
      };
    });

    return {
      shops: list.length,
      solo: list.filter((s) => s.plan === "solo").length,
      suspended: list.filter((s) => s.suspended_at).length,
      activeShops: all.filter((r) => r.bookings > 0).length,
      bookings: sum("bookings"),
      bookedCents: sum("booked_cents"),
      textsSent: sum("texts_sent"),
      textsFailed: sum("texts_failed"),
      siteViews: sum("site_views"),
      twilioReady: smsConfig() !== null,
      sources: unwrap(sources).map((s) => ({ source: s.source, bookings: s.bookings })),
      signups,
      newest: [...list]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5)
        .map((s) => ({ id: s.id, name: s.name, slug: s.slug, createdAt: s.created_at })),
    };
  }),

  /** Every shop with its owner and 30-day activity. */
  shops: adminProcedure.query(async ({ ctx }) => {
    const shops = unwrap(
      await ctx.db.from("shops").select(SHOP_COLUMNS).order("created_at", { ascending: false }),
    );
    const [stats, owned] = await Promise.all([
      shopStats(ctx.db),
      owners(
        ctx.db,
        shops.map((s) => s.id),
      ),
    ]);
    return shops.map((s) => {
      const st = stats.get(s.id);
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        plan: s.plan,
        createdAt: s.created_at,
        suspended: s.suspended_at !== null,
        premiumTemplates: s.premium_templates,
        owners: owned.get(s.id) ?? [],
        staff: st?.staff ?? 0,
        clients: st?.clients ?? 0,
        bookings: st?.bookings ?? 0,
        bookedCents: Number(st?.booked_cents ?? 0),
        lastBookingAt: st?.last_booking_at ?? null,
        textsSent: st?.texts_sent ?? 0,
        textsFailed: st?.texts_failed ?? 0,
        siteViews: st?.site_views ?? 0,
      };
    });
  }),

  /** One shop in detail: team, activity, texting problems and its audit trail. */
  shop: adminProcedure.input(shopInput).query(async ({ ctx, input }) => {
    const shop = unwrap(
      await ctx.db.from("shops").select(SHOP_COLUMNS).eq("id", input.shopId).maybeSingle(),
    );
    if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

    const [stats, staff, services, failures, log] = await Promise.all([
      shopStats(ctx.db),
      ctx.db
        .from("staff")
        .select("id, display_name, role, email, is_active, is_bookable, user_id, created_at")
        .eq("shop_id", shop.id)
        .order("sort_order"),
      ctx.db
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("is_active", true),
      ctx.db
        .from("messages")
        .select("id, kind, error, created_at")
        .eq("shop_id", shop.id)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(10),
      ctx.db
        .from("admin_audit_log")
        .select("id, admin_user_id, action, detail, created_at")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    if (services.error) throw services.error;
    const entries = unwrap(log);
    const who = await emails(
      ctx.db,
      entries.map((e) => e.admin_user_id),
    );
    const st = stats.get(shop.id);
    const template = isTemplateId(shop.site_template) ? shop.site_template : "classic";

    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      plan: shop.plan,
      timezone: shop.timezone,
      createdAt: shop.created_at,
      suspendedAt: shop.suspended_at,
      suspendedReason: shop.suspended_reason,
      premiumTemplates: shop.premium_templates,
      smsEnabled: shop.sms_enabled,
      template: { id: template, name: TEMPLATES[template].name, tier: TEMPLATES[template].tier },
      siteUrl: shopSiteUrl({ slug: shop.slug, customDomain: shop.custom_domain }, sitesUrl()),
      bookingPath: `/book/${shop.slug}`,
      services: services.count ?? 0,
      stats: {
        clients: st?.clients ?? 0,
        bookings: st?.bookings ?? 0,
        bookedCents: Number(st?.booked_cents ?? 0),
        lastBookingAt: st?.last_booking_at ?? null,
        textsSent: st?.texts_sent ?? 0,
        textsFailed: st?.texts_failed ?? 0,
        siteViews: st?.site_views ?? 0,
      },
      team: unwrap(staff).map((s) => ({
        id: s.id,
        name: s.display_name,
        role: s.role,
        email: s.email,
        active: s.is_active,
        bookable: s.is_bookable,
        signedUp: s.user_id !== null,
      })),
      failedTexts: unwrap(failures).map((m) => ({
        id: m.id,
        kind: m.kind,
        error: m.error,
        at: m.created_at,
      })),
      audit: entries.map((e) => ({
        id: e.id,
        action: e.action,
        detail: e.detail,
        at: e.created_at,
        by: who.get(e.admin_user_id) ?? e.admin_user_id,
      })),
    };
  }),

  /** Plan and premium access. Only the fields sent are changed. */
  updateShop: adminProcedure
    .input(
      shopInput.extend({
        plan: z.enum(["solo", "shop"]).optional(),
        premiumTemplates: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = unwrap(
        await ctx.db
          .from("shops")
          .select("plan, premium_templates")
          .eq("id", input.shopId)
          .maybeSingle(),
      );
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

      const change: { plan?: "solo" | "shop"; premium_templates?: boolean } = {};
      if (input.plan !== undefined && input.plan !== before.plan) change.plan = input.plan;
      if (
        input.premiumTemplates !== undefined &&
        input.premiumTemplates !== before.premium_templates
      ) {
        change.premium_templates = input.premiumTemplates;
      }
      if (!Object.keys(change).length) return { changed: false };

      unwrap(
        await ctx.db.from("shops").update(change).eq("id", input.shopId).select("id").single(),
      );
      await audit({
        adminUserId: ctx.userId,
        action: "shop.update",
        shopId: input.shopId,
        detail: {
          ...(change.plan ? { plan: { from: before.plan, to: change.plan } } : {}),
          ...(change.premium_templates !== undefined
            ? {
                premiumTemplates: {
                  from: before.premium_templates,
                  to: change.premium_templates,
                },
              }
            : {}),
        },
      });
      return { changed: true };
    }),

  /** Takes a shop's booking page, website and texts offline. Data is kept. */
  suspend: adminProcedure
    .input(shopInput.extend({ reason: z.string().trim().min(3).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const shop = unwrap(
        await ctx.db
          .from("shops")
          .update({ suspended_at: new Date().toISOString(), suspended_reason: input.reason })
          .eq("id", input.shopId)
          .is("suspended_at", null)
          .select("id")
          .maybeSingle(),
      );
      if (!shop) {
        throw new TRPCError({ code: "CONFLICT", message: "That shop is already suspended." });
      }
      await audit({
        adminUserId: ctx.userId,
        action: "shop.suspend",
        shopId: input.shopId,
        detail: { reason: input.reason },
      });
      return { ok: true };
    }),

  unsuspend: adminProcedure.input(shopInput).mutation(async ({ ctx, input }) => {
    const shop = unwrap(
      await ctx.db
        .from("shops")
        .update({ suspended_at: null, suspended_reason: null })
        .eq("id", input.shopId)
        .not("suspended_at", "is", null)
        .select("id")
        .maybeSingle(),
    );
    if (!shop) throw new TRPCError({ code: "CONFLICT", message: "That shop isn't suspended." });
    await audit({ adminUserId: ctx.userId, action: "shop.unsuspend", shopId: input.shopId });
    return { ok: true };
  }),

  /** Everything admins have changed, newest first. */
  audit: adminProcedure
    .input(z.object({ cursor: z.number().int().positive().nullish() }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from("admin_audit_log")
        .select("id, admin_user_id, action, shop_id, detail, created_at")
        .order("id", { ascending: false })
        .limit(50);
      if (input.cursor) query = query.lt("id", input.cursor);
      const entries = unwrap(await query);
      const shopIds = [...new Set(entries.map((e) => e.shop_id).filter((id) => id !== null))];
      const [who, shops] = await Promise.all([
        emails(
          ctx.db,
          entries.map((e) => e.admin_user_id),
        ),
        ctx.db.from("shops").select("id, name").in("id", shopIds),
      ]);
      const names = new Map(unwrap(shops).map((s) => [s.id, s.name]));
      return {
        entries: entries.map((e) => ({
          id: e.id,
          action: e.action,
          detail: e.detail,
          at: e.created_at,
          by: who.get(e.admin_user_id) ?? e.admin_user_id,
          shop: e.shop_id ? { id: e.shop_id, name: names.get(e.shop_id) ?? "Deleted shop" } : null,
        })),
        next: entries.length === 50 ? entries.at(-1)?.id : undefined,
      };
    }),
});
