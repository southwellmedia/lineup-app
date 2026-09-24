import { formatHour, type DayHours } from "./hours";

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday (0 = Sunday) and "HH:MM" for an instant in a timezone. */
function localNow(now: Date, timezone: string): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: SHORT_DAYS.indexOf(get("weekday")), time: `${get("hour")}:${get("minute")}` };
}

/**
 * "Open now · until 7 PM", "Opens at 10 AM", "Closed · opens Tue 10 AM", in
 * the shop's timezone regardless of where the visitor is.
 */
export function openStatus(
  days: DayHours[],
  timezone: string,
  now: Date,
): { open: boolean; text: string } {
  const { weekday, time } = localNow(now, timezone);
  const today = days.find((d) => d.weekday === weekday)?.open ?? [];

  const current = today.find((b) => b.start <= time && time < b.end);
  if (current) return { open: true, text: `Open now · until ${formatHour(current.end)}` };

  const laterToday = today.find((b) => b.start > time);
  if (laterToday) return { open: false, text: `Opens at ${formatHour(laterToday.start)}` };

  for (let i = 1; i <= 7; i += 1) {
    const day = (weekday + i) % 7;
    const first = days.find((d) => d.weekday === day)?.open[0];
    if (first) {
      const label = i === 1 ? "tomorrow" : SHORT_DAYS[day];
      return { open: false, text: `Closed · opens ${label} ${formatHour(first.start)}` };
    }
  }
  return { open: false, text: "Closed" };
}
