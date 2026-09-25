import { DateTime } from "luxon";

/* What clients read. Short, plain, one segment, and always name the shop first. */

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
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* Carriers bill per segment: 160 characters in the GSM-7 alphabet, but only
   70 once any other character (an emoji, a curly quote) appears, and 153/67
   per part when a text is split. Texts try shorter wordings until one fits
   in a single segment. */

const GSM =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";

/** Swaps typographic punctuation for plain ASCII so a text stays GSM-7. */
export function plain(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

/** How many segments a text is billed as. */
export function segments(text: string): number {
  let units = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM.includes(ch)) units += 1;
    else if (GSM_EXTENDED.includes(ch)) units += 2;
    else gsm = false;
  }
  if (!gsm) {
    const length = [...text].reduce((n, ch) => n + (ch.length > 1 ? 2 : 1), 0);
    return length <= 70 ? 1 : Math.ceil(length / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
}

/** The first wording that fits in one segment, else the shortest. */
function fit(wordings: string[]): string {
  const texts = wordings.map(plain);
  return (
    texts.find((t) => segments(t) === 1) ??
    texts.reduce((a, b) => (segments(b) < segments(a) ? b : a))
  );
}

/** "Fade + Beard Trim with Andrea", then shorter versions of it. */
function whats(f: BookingFacts): string[] {
  const all = f.services.join(" + ") || "your appointment";
  const [one, ...rest] = f.services;
  const short = one ? `${one}${rest.length ? ` +${rest.length} more` : ""}` : all;
  const barber = f.barberName ? ` with ${f.barberName}` : "";
  return [...new Set([`${all}${barber}`, `${short}${barber}`, short])];
}

export function confirmationText(f: BookingFacts): string {
  const at = when(f, "ccc LLL d 'at' h:mm a");
  const end = "Reply C to confirm, X to cancel, STOP to opt out.";
  return fit([
    ...whats(f).map(
      (w) => `${f.shopName}: you're booked, ${first(f.clientName)}. ${w}, ${at}. ${end}`,
    ),
    ...whats(f).map((w) => `${f.shopName}: booked ${w}, ${at}. ${end}`),
  ]);
}

export function reminderText(kind: "reminder_24h" | "reminder_2h", f: BookingFacts): string {
  const at = when(f, "h:mm a");
  if (kind === "reminder_24h") {
    return fit(
      whats(f).map(
        (w) =>
          `${f.shopName}: see you tomorrow at ${at} for ${w}. Reply C to confirm or X to cancel.`,
      ),
    );
  }
  const hello = `${f.shopName}: see you at ${at}, ${first(f.clientName)}.`;
  return fit([f.address ? `${hello} ${f.address}` : hello, hello]);
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
