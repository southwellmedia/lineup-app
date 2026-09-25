import { DateTime } from "luxon";

/* What clients read. Short, plain, and always name the shop first. */

export type BookingFacts = {
  shopName: string;
  clientName: string;
  services: string[];
  barberName: string | null;
  startsAt: string;
  timezone: string;
  address: string | null;
  shopPhone: string | null;
};

const when = (f: BookingFacts, format: string) =>
  DateTime.fromISO(f.startsAt, { zone: f.timezone }).toFormat(format);
const what = (f: BookingFacts) =>
  `${f.services.join(" + ") || "your appointment"}${f.barberName ? ` with ${f.barberName}` : ""}`;
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function confirmationText(f: BookingFacts): string {
  return [
    `${f.shopName}: you're booked, ${first(f.clientName)}. ${what(f)}, ${when(f, "ccc LLL d 'at' h:mm a")}.`,
    f.address ? f.address : null,
    "Reply C to confirm or X to cancel. Reply STOP to opt out.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function reminderText(kind: "reminder_24h" | "reminder_2h", f: BookingFacts): string {
  if (kind === "reminder_24h") {
    return `${f.shopName}: see you tomorrow at ${when(f, "h:mm a")} for ${what(f)}. Reply C to confirm or X to cancel.`;
  }
  return `${f.shopName}: see you at ${when(f, "h:mm a")}, ${first(f.clientName)}.${f.address ? ` ${f.address}` : ""}`;
}

export type ReplyIntent = "confirm" | "cancel" | "stop" | "start" | "other";

/** What a client's reply means. Carriers handle STOP too; we honor it as well. */
export function parseReply(body: string): ReplyIntent {
  const word = body
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (["c", "confirm", "confirmed", "yes", "y", "ok", "okay", "yep", "yeah"].includes(word))
    return "confirm";
  if (["x", "cancel", "cancelled", "canceled", "no"].includes(word)) return "cancel";
  if (["stop", "stopall", "unsubscribe", "end", "quit", "optout", "revoke"].includes(word))
    return "stop";
  if (["start", "unstop", "subscribe"].includes(word)) return "start";
  return "other";
}
