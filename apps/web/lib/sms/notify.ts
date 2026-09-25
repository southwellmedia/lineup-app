import "server-only";
import type { Database } from "@lineup/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { confirmationText, reminderText, type BookingFacts } from "./templates";
import { sendSms, smsConfig } from "./twilio";

type Db = SupabaseClient<Database>;
type Kind = "confirmation" | "reminder_24h" | "reminder_2h";

export type TextOutcome =
  | { status: "sent" | "failed" | "skipped"; reason?: string }
  | { status: "not_needed"; reason: string };

/** Everything a booking text needs, or null if the booking is gone. */
export async function bookingFacts(db: Db, appointmentId: string) {
  const { data: a } = await db
    .from("appointments")
    .select("id, shop_id, client_id, staff_id, status, starts_at, created_at")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!a?.client_id) return null;
  const [shop, client, staff, items] = await Promise.all([
    db
      .from("shops")
      .select(
        "name, slug, timezone, phone, address_line, city, sms_enabled, sms_reminder_24h, sms_reminder_2h, cancellation_window_minutes",
      )
      .eq("id", a.shop_id)
      .single(),
    db.from("clients").select("id, name, phone, sms_consent_at").eq("id", a.client_id).single(),
    db.from("staff").select("display_name").eq("id", a.staff_id).single(),
    db
      .from("appointment_services")
      .select("name, is_addon")
      .eq("appointment_id", a.id)
      .order("is_addon"),
  ]);
  if (!shop.data || !client.data) return null;
  const facts: BookingFacts = {
    shopName: shop.data.name,
    clientName: client.data.name,
    services: (items.data ?? []).map((i) => i.name),
    barberName: staff.data?.display_name ?? null,
    startsAt: a.starts_at,
    timezone: shop.data.timezone,
    address: [shop.data.address_line, shop.data.city].filter(Boolean).join(", ") || null,
    shopPhone: shop.data.phone,
  };
  return { appointment: a, shop: shop.data, client: client.data, facts };
}

/**
 * Sends a booking's confirmation or reminder, once. Checks the shop's
 * switches and the client's consent; each text is claimed in `messages`
 * before sending, so retries and overlapping jobs can't double-send. Never
 * throws: texting must not break a booking.
 */
export async function textBooking(appointmentId: string, kind: Kind): Promise<TextOutcome> {
  const db = adminClient();
  try {
    const found = await bookingFacts(db, appointmentId);
    if (!found) return { status: "not_needed", reason: "No booking or client." };
    const { appointment, shop, client, facts } = found;

    if (appointment.status !== "confirmed")
      return { status: "not_needed", reason: "Not a live booking." };
    if (!shop.sms_enabled) return { status: "not_needed", reason: "Texts are off for this shop." };
    if (kind === "reminder_24h" && !shop.sms_reminder_24h)
      return { status: "not_needed", reason: "24h reminders are off." };
    if (kind === "reminder_2h" && !shop.sms_reminder_2h)
      return { status: "not_needed", reason: "2h reminders are off." };
    if (!client.phone) return { status: "not_needed", reason: "No phone number." };
    if (!client.sms_consent_at)
      return { status: "not_needed", reason: "Client hasn't agreed to texts." };

    const body = kind === "confirmation" ? confirmationText(facts) : reminderText(kind, facts);
    const config = smsConfig();

    // Claim this text. A duplicate means it was already handled.
    const claim = await db
      .from("messages")
      .insert({
        shop_id: appointment.shop_id,
        client_id: client.id,
        appointment_id: appointment.id,
        direction: "outbound",
        kind,
        phone: client.phone,
        body,
        status: config ? "queued" : "skipped",
        error: config ? null : "Texting isn't connected yet (add Twilio keys).",
      })
      .select("id")
      .single();
    if (claim.error?.code === "23505") return { status: "not_needed", reason: "Already sent." };
    if (claim.error) return { status: "failed", reason: claim.error.message };
    if (!config) return { status: "skipped", reason: "Twilio isn't connected." };

    const result = await sendSms(config, client.phone, body);
    await db
      .from("messages")
      .update(
        result.status === "sent"
          ? { status: "sent", provider_id: result.providerId }
          : { status: "failed", error: result.error },
      )
      .eq("id", claim.data.id);
    return result.status === "sent"
      ? { status: "sent" }
      : { status: "failed", reason: result.error };
  } catch (error) {
    console.error("booking text failed", error);
    return { status: "failed", reason: String(error) };
  }
}
