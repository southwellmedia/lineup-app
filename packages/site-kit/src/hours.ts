export type HoursRow = { weekday: number; start: string; end: string };
export type DayHours = { weekday: number; open: { start: string; end: string }[] };

/**
 * The shop's opening hours: for each weekday, the union of every barber's
 * working blocks, with overlapping or touching blocks merged. Sunday = 0.
 */
export function shopHours(rows: HoursRow[]): DayHours[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const blocks = rows
      .filter((r) => r.weekday === weekday)
      .map((r) => ({ start: r.start.slice(0, 5), end: r.end.slice(0, 5) }))
      .sort((a, b) => a.start.localeCompare(b.start));

    const open: { start: string; end: string }[] = [];
    for (const block of blocks) {
      const last = open[open.length - 1];
      if (last && block.start <= last.end) {
        if (block.end > last.end) last.end = block.end;
      } else {
        open.push({ ...block });
      }
    }
    return { weekday, open };
  });
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "10:00" → "10 AM", "14:30" → "2:30 PM". */
export function formatHour(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** Monday-first rows for display: [{ day: "Monday", text: "10 AM – 7 PM" | "Closed" }]. */
export function hoursTable(days: DayHours[]): { day: string; text: string }[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const open = days.find((d) => d.weekday === weekday)?.open ?? [];
    return {
      day: DAY_NAMES[weekday] ?? "",
      text: open.length
        ? open.map((b) => `${formatHour(b.start)} – ${formatHour(b.end)}`).join(", ")
        : "Closed",
    };
  });
}

const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** schema.org openingHoursSpecification entries for structured data. */
export function openingHoursSpecification(days: DayHours[]) {
  return days.flatMap((d) =>
    d.open.map((b) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[d.weekday]}`,
      opens: b.start,
      closes: b.end,
    })),
  );
}
