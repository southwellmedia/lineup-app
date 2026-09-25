/**
 * The text that goes with a shared photo. The client is tagged only when
 * they agreed to social sharing and gave a handle; the booking link turns a
 * post into bookings (with ?src=instagram for attribution).
 */
export function shareCaption(args: {
  caption?: string | null;
  services: string[];
  barberName?: string | null;
  shopInstagram?: string | null;
  shopName: string;
  clientInstagram?: string | null;
  consent: "private" | "portfolio" | "social";
  bookingUrl: string;
}): string {
  const cut = args.services.length ? args.services.join(" + ") : "Fresh cut";
  const lines = [
    args.caption?.trim() || `${cut}${args.barberName ? ` by ${args.barberName}` : ""} ✂️`,
    args.consent === "social" && args.clientInstagram ? `On @${args.clientInstagram}` : null,
    args.shopInstagram ? `@${args.shopInstagram}` : args.shopName,
    `Book: ${args.bookingUrl}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Only social consent may leave the shop through the share sheet. */
export function canShare(consent: "private" | "portfolio" | "social", isMinor: boolean): boolean {
  return consent === "social" && !isMinor;
}
