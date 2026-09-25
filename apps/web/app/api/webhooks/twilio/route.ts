import { DateTime } from "luxon";
import type { NextRequest } from "next/server";
import { formatPhone } from "@/lib/dashboard/summary";
import { bookingFacts } from "@/lib/sms/notify";
import { parseReply } from "@/lib/sms/templates";
import { smsConfig, twiml, validTwilioSignature } from "@/lib/sms/twilio";
import { adminClient } from "@/lib/supabase/admin";

const xml = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/xml" } });

/**
 * Replies to booking texts. Twilio posts here for every incoming message;
 * the request must carry a valid X-Twilio-Signature. The booking is the one
 * we last texted this number about.
 */
export async function POST(request: NextRequest) {
  const config = smsConfig();
  if (!config) return xml(twiml(), 503);

  const params = Object.fromEntries(new URLSearchParams(await request.text())) as Record<
    string,
    string
  >;
  // Behind a proxy request.url can differ from what Twilio signed; allow an override.
  const url = process.env.TWILIO_WEBHOOK_URL || request.url;
  if (
    !validTwilioSignature(config.authToken, url, params, request.headers.get("x-twilio-signature"))
  ) {
    return xml(twiml(), 403);
  }

  const from = params.From ?? "";
  const body = (params.Body ?? "").slice(0, 1600);
  const db = adminClient();
  const intent = parseReply(body);

  // The booking we last texted this number about (within 30 days).
  const { data: last } = await db
    .from("messages")
    .select("shop_id, client_id, appointment_id")
    .eq("phone", from)
    .eq("direction", "outbound")
    .not("appointment_id", "is", null)
    .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await db.from("messages").insert({
    shop_id: last?.shop_id ?? null,
    client_id: last?.client_id ?? null,
    appointment_id: last?.appointment_id ?? null,
    direction: "inbound",
    kind: "inbound",
    phone: from,
    body: body || "(empty)",
    status: "received",
    provider_id: params.MessageSid ?? null,
  });

  if (intent === "stop") {
    // Carriers confirm the opt-out themselves; we just stop texting them.
    await db.from("clients").update({ sms_consent_at: null }).eq("phone", from);
    return xml(twiml());
  }
  if (intent === "start" || !last?.appointment_id) return xml(twiml());

  const found = await bookingFacts(db, last.appointment_id);
  if (!found) return xml(twiml());
  const { appointment, shop } = found;
  const time = DateTime.fromISO(appointment.starts_at, { zone: shop.timezone }).toFormat(
    "ccc LLL d 'at' h:mm a",
  );
  const call = shop.phone ? ` Call ${formatPhone(shop.phone)}.` : "";

  const active =
    appointment.status === "confirmed" && Date.parse(appointment.starts_at) >= Date.now();

  // A "C" gets no reply: it would cost a text and tell them nothing new.
  if (intent === "confirm") {
    if (active) {
      await db
        .from("appointments")
        .update({ client_confirmed_at: new Date().toISOString() })
        .eq("id", appointment.id);
    }
    return xml(twiml());
  }

  let reply: string;
  if (!active) {
    reply = `${shop.name}: that booking isn't active anymore.${call}`;
  } else if (intent === "cancel") {
    const minutesAway = (Date.parse(appointment.starts_at) - Date.now()) / 60_000;
    if (minutesAway < shop.cancellation_window_minutes) {
      reply = `${shop.name}: it's too close to your appointment to cancel by text.${call || " Please call the shop."}`;
    } else {
      const { error } = await db.rpc("cancel_appointment", {
        p_appointment_id: appointment.id,
        p_cancelled_by: "client",
        p_reason: "Cancelled by text",
      });
      reply = error
        ? `${shop.name}: we couldn't cancel that.${call}`
        : `${shop.name}: cancelled your ${time} booking. Book again anytime.`;
    }
  } else {
    reply = `${shop.name}: reply C to confirm or X to cancel your ${time} booking.${call}`;
  }

  await db.from("messages").insert({
    shop_id: appointment.shop_id,
    client_id: appointment.client_id,
    appointment_id: appointment.id,
    direction: "outbound",
    kind: "reply",
    phone: from,
    body: reply,
    status: "sent",
  });
  return xml(twiml(reply));
}
