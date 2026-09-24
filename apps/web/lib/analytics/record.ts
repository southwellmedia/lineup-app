import "server-only";
import { serverEnv } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";
import { deviceOf, isBot, visitorHash } from "./event";

export type SiteEvent = {
  shopId: string;
  kind: "pageview" | "book_click" | "booking_view";
  path: string;
  referrer: string | null;
  source?: string | null;
  ip: string;
  userAgent: string;
};

/**
 * Stores one analytics event. Bots are dropped. Never throws: analytics must
 * not break a page or a booking.
 */
export async function recordSiteEvent(event: SiteEvent): Promise<void> {
  if (isBot(event.userAgent)) return;
  try {
    const salt = process.env.ANALYTICS_SALT || serverEnv().SUPABASE_SECRET_KEY;
    const { error } = await adminClient()
      .from("site_events")
      .insert({
        shop_id: event.shopId,
        kind: event.kind,
        path: event.path,
        referrer: event.referrer,
        source: event.source ?? null,
        visitor: visitorHash({
          salt,
          day: new Date().toISOString().slice(0, 10),
          shopId: event.shopId,
          ip: event.ip,
          userAgent: event.userAgent,
        }),
        device: deviceOf(event.userAgent),
      });
    if (error) console.error("site event not recorded", error.message);
  } catch (error) {
    console.error("site event not recorded", error);
  }
}
