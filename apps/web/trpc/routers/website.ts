import { TRPCError } from "@trpc/server";
import type { Database } from "@lineup/db";
import { DateTime } from "luxon";
import { z } from "zod";
import { fillDays, siteReport } from "@/lib/analytics/report";
import { localDaysWindow } from "@/lib/booking/time";
import { sitesUrl } from "@/lib/env";
import { shopSiteUrl, siteChecklist } from "@/lib/site/overview";
import { loadSiteData } from "@/lib/site/site-data";
import { adminClient } from "@/lib/supabase/admin";
import { unwrap } from "../errors";
import { managerProcedure, router } from "../init";

type Source = Database["public"]["Enums"]["booking_source"];

/** Bookings that happened (or still will): not abandoned holds or cancellations. */
const COUNTED = ["confirmed", "checked_in", "completed", "no_show"] as const;

export const websiteRouter = router({
  /** The shop's site address and what the site is still missing. */
  overview: managerProcedure.query(async ({ ctx }) => {
    const shop = unwrap(
      await ctx.supabase.from("shops").select("slug").eq("id", ctx.shopId).maybeSingle(),
    );
    if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

    // Same public data the website renders, so the checklist matches the site.
    const site = await loadSiteData(adminClient(), { slug: shop.slug }, "");
    if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

    return {
      url: shopSiteUrl({ slug: site.shop.slug, customDomain: site.shop.customDomain }, sitesUrl()),
      customDomain: site.shop.customDomain,
      checklist: siteChecklist(site),
    };
  }),

  /**
   * Website traffic and what it turned into over the last `days` local days:
   * visitors, Book clicks, booking-page visits, bookings and their value, plus
   * bookings from every source for comparison.
   */
  analytics: managerProcedure
    .input(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) }))
    .query(async ({ ctx, input }) => {
      const shop = unwrap(
        await ctx.supabase.from("shops").select("timezone").eq("id", ctx.shopId).maybeSingle(),
      );
      if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "Shop not found." });

      const today = DateTime.now().setZone(shop.timezone).startOf("day");
      const from = today.minus({ days: input.days - 1 }).toISODate() ?? "";
      const window = localDaysWindow(from, input.days, shop.timezone);

      const [report, bookings] = await Promise.all([
        ctx.supabase.rpc("site_analytics", {
          p_shop_id: ctx.shopId,
          p_from: window.start.toISOString(),
          p_to: window.end.toISOString(),
        }),
        ctx.supabase
          .from("appointments")
          .select("source, total_price_cents, created_at")
          .eq("shop_id", ctx.shopId)
          .in("status", [...COUNTED])
          .gte("created_at", window.start.toISOString())
          .lt("created_at", window.end.toISOString())
          .limit(20_000),
      ]);
      const traffic = siteReport.parse(unwrap(report));
      const rows = unwrap(bookings);

      const bySource = new Map<Source, number>();
      const siteByDay = new Map<string, number>();
      let siteBookings = 0;
      let siteValueCents = 0;
      for (const row of rows) {
        bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);
        if (row.source !== "website") continue;
        siteBookings += 1;
        siteValueCents += row.total_price_cents;
        const day = DateTime.fromISO(row.created_at).setZone(shop.timezone).toISODate() ?? "";
        siteByDay.set(day, (siteByDay.get(day) ?? 0) + 1);
      }

      return {
        days: input.days,
        from,
        visitors: traffic.totals.visitors,
        pageviews: traffic.totals.pageviews,
        bookClicks: traffic.totals.bookClicks,
        bookingPageVisits: traffic.totals.bookingViewsFromSite,
        bookings: siteBookings,
        bookedValueCents: siteValueCents,
        daily: fillDays(from, input.days, traffic.daily, siteByDay),
        pages: traffic.pages,
        referrers: traffic.referrers,
        bookingPageSources: traffic.bookingSources,
        sources: [...bySource]
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count),
      };
    }),
});
