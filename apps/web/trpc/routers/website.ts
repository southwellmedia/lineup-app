import { TRPCError } from "@trpc/server";
import type { Database } from "@lineup/db";
import { sitesUrl } from "@/lib/env";
import { shopSiteUrl, siteChecklist } from "@/lib/site/overview";
import { loadSiteData } from "@/lib/site/site-data";
import { adminClient } from "@/lib/supabase/admin";
import { unwrap } from "../errors";
import { managerProcedure, router } from "../init";

type Source = Database["public"]["Enums"]["booking_source"];

const SOURCE_WINDOW_DAYS = 30;

export const websiteRouter = router({
  /** The shop's site address, what it's missing, and where bookings came from lately. */
  overview: managerProcedure.query(async ({ ctx }) => {
    const shop = unwrap(
      await ctx.supabase.from("shops").select("slug").eq("id", ctx.shopId).maybeSingle(),
    );
    if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

    // Same public data the website renders, so the checklist matches the site.
    const site = await loadSiteData(adminClient(), { slug: shop.slug }, "");
    if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

    const since = new Date(Date.now() - SOURCE_WINDOW_DAYS * 86_400_000).toISOString();
    const rows = unwrap(
      await ctx.supabase
        .from("appointments")
        .select("source")
        .eq("shop_id", ctx.shopId)
        .neq("status", "held")
        .gte("created_at", since)
        .limit(10_000),
    );
    const counts = new Map<Source, number>();
    for (const row of rows) counts.set(row.source, (counts.get(row.source) ?? 0) + 1);

    return {
      url: shopSiteUrl({ slug: site.shop.slug, customDomain: site.shop.customDomain }, sitesUrl()),
      customDomain: site.shop.customDomain,
      checklist: siteChecklist(site),
      sourceWindowDays: SOURCE_WINDOW_DAYS,
      sources: [...counts]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
    };
  }),
});
