import "server-only";
import type { Database } from "@lineup/db";
import type { AvailabilityInput, Interval } from "@lineup/scheduling";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { unwrap } from "@/trpc/errors";
import { summarizeServices, type ServiceSummary } from "./services";
import { parseTstzRange, toHourMinute } from "./time";

type Db = SupabaseClient<Database>;

export const PUBLIC_SHOP_COLUMNS =
  "id, name, slug, timezone, plan, brand_color, min_booking_notice_minutes, max_booking_advance_days, slot_interval_minutes, cancellation_window_minutes, late_cancel_fee_cents, no_show_fee_cents" as const;

export async function getShopBySlug(db: Db, slug: string) {
  const shop = unwrap(
    await db.from("shops").select(PUBLIC_SHOP_COLUMNS).eq("slug", slug).maybeSingle(),
  );
  if (!shop) throw new TRPCError({ code: "NOT_FOUND", message: "We couldn't find that shop." });
  return shop;
}

export type Shop = Awaited<ReturnType<typeof getShopBySlug>>;

/** The statuses that occupy a barber's time (matches appointments_no_overlap). */
const LIVE_STATUSES = ["held", "confirmed", "checked_in", "completed"] as const;

export type BookingContext = {
  shop: Shop;
  summary: ServiceSummary;
  /** Everything the scheduling engine needs except the search window. */
  schedule: Omit<AvailabilityInput, "from" | "to">;
};

/**
 * Loads what's needed to check a barber's availability for a set of
 * services within `window`: their hours, time off, existing bookings and
 * live holds, plus the service totals.
 */
export async function loadBookingContext(
  db: Db,
  args: { shopSlug: string; staffId: string; serviceIds: string[]; window: Interval; now: Date },
): Promise<BookingContext> {
  const shop = await getShopBySlug(db, args.shopSlug);

  const staff = unwrap(
    await db
      .from("staff")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("id", args.staffId)
      .eq("is_active", true)
      .eq("is_bookable", true)
      .maybeSingle(),
  );
  if (!staff)
    throw new TRPCError({ code: "NOT_FOUND", message: "That barber isn't taking bookings." });

  const [services, staffServices] = await Promise.all([
    db
      .from("services")
      .select(
        "id, duration_minutes, buffer_after_minutes, price_cents, deposit_cents, is_addon, is_active",
      )
      .eq("shop_id", shop.id)
      .in("id", args.serviceIds),
    db
      .from("staff_services")
      .select("service_id, price_cents, duration_minutes")
      .eq("staff_id", staff.id)
      .in("service_id", args.serviceIds),
  ]);

  const result = summarizeServices(args.serviceIds, unwrap(services), unwrap(staffServices));
  if (!result.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        result.error === "addon_only"
          ? "Add-ons need to be booked with a main service."
          : "That barber doesn't offer one of those services.",
    });
  }
  const { summary } = result;

  // Look far enough past the window for bookings a late slot's buffer could hit.
  const occupiedMs = (summary.durationMinutes + summary.bufferAfterMinutes) * 60_000;
  const from = args.window.start.toISOString();
  const to = new Date(args.window.end.getTime() + occupiedMs).toISOString();

  const [hours, timeOff, appointments] = await Promise.all([
    db.from("working_hours").select("weekday, start_time, end_time").eq("staff_id", staff.id),
    db
      .from("time_off")
      .select("during")
      .eq("staff_id", staff.id)
      .overlaps("during", `[${from},${to})`),
    db
      .from("appointments")
      .select("starts_at, blocked_until")
      .eq("staff_id", staff.id)
      .in("status", LIVE_STATUSES)
      // A hold only blocks the slot until it expires.
      .or(`status.neq.held,hold_expires_at.gt.${args.now.toISOString()}`)
      .lt("starts_at", to)
      .gt("blocked_until", from),
  ]);

  return {
    shop,
    summary,
    schedule: {
      timezone: shop.timezone,
      now: args.now,
      workingHours: unwrap(hours).map((h) => ({
        weekday: h.weekday,
        start: toHourMinute(h.start_time),
        end: toHourMinute(h.end_time),
      })),
      timeOff: unwrap(timeOff).flatMap((t) => parseTstzRange(t.during) ?? []),
      busy: unwrap(appointments).map((a) => ({
        start: new Date(a.starts_at),
        end: new Date(a.blocked_until),
      })),
      durationMinutes: summary.durationMinutes,
      bufferAfterMinutes: summary.bufferAfterMinutes,
      slotIntervalMinutes: shop.slot_interval_minutes,
      minNoticeMinutes: shop.min_booking_notice_minutes,
      maxAdvanceDays: shop.max_booking_advance_days,
    },
  };
}
