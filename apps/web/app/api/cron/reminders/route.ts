import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { reminderDue } from "@/lib/sms/reminders";
import { textBooking } from "@/lib/sms/notify";
import { adminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Sends due reminders. Called every 15 minutes by pg_cron in Supabase (see
 * the text_messages migration) with `Authorization: Bearer $CRON_SECRET`.
 * Safe to call more often: each reminder is sent at most once.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { data, error } = await adminClient()
    .from("appointments")
    .select("id, starts_at, created_at")
    .eq("status", "confirmed")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + 24 * 3_600_000).toISOString())
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Record<string, number> = {};
  for (const a of data) {
    for (const kind of ["reminder_24h", "reminder_2h"] as const) {
      if (!reminderDue(kind, { startsAt: a.starts_at, createdAt: a.created_at }, now)) continue;
      const outcome = await textBooking(a.id, kind);
      results[outcome.status] = (results[outcome.status] ?? 0) + 1;
    }
  }
  return NextResponse.json({ checked: data.length, results });
}
