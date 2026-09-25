const HOUR = 3_600_000;

/**
 * Whether a reminder is due now. A reminder only makes sense if the booking
 * was made well before it: someone who booked this morning for tonight
 * already has their confirmation.
 *
 * - 24h: within 24 hours of the start (and more than 3 hours out), for
 *   bookings made at least 26 hours ahead.
 * - 2h: within 2 hours of the start (and not started), for bookings made at
 *   least 3 hours ahead.
 */
export function reminderDue(
  kind: "reminder_24h" | "reminder_2h",
  appointment: { startsAt: string; createdAt: string },
  now: Date,
): boolean {
  const start = Date.parse(appointment.startsAt);
  const created = Date.parse(appointment.createdAt);
  const untilStart = start - now.getTime();
  const leadTime = start - created;
  if (kind === "reminder_24h")
    return untilStart <= 24 * HOUR && untilStart > 3 * HOUR && leadTime >= 26 * HOUR;
  return untilStart <= 2 * HOUR && untilStart > 0 && leadTime >= 3 * HOUR;
}
