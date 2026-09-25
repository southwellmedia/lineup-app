/** "SC" from "Southside Cuts": the film-edge code on nav and footer. */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase() || "LU"
  );
}

/**
 * Splits a heading so the last word can be set light, as the template does:
 * "The Full Hour" → ["The Full", "Hour"]; one word → [word, ""].
 */
export function splitLast(text: string): [string, string] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return [text.trim(), ""];
  return [words.slice(0, -1).join(" "), words[words.length - 1] ?? ""];
}

/**
 * Hero headline size, so line one fills its column. Big Shoulders' capitals
 * average ~0.45em wide; 205/length leaves a margin for wide letters and for
 * the moment before the web font loads.
 */
export function heroSize(line: string): string {
  const length = Math.max(4, line.length);
  return `min(300px, ${Math.floor(205 / length)}cqi)`;
}

/** Consecutive days with the same hours, e.g. "Tue — Sat · 10 AM – 7 PM". */
export function groupHours(
  rows: { day: string; text: string }[],
): { days: string; time: string; open: boolean }[] {
  const out: { days: string; time: string; open: boolean; first: string; last: string }[] = [];
  for (const row of rows) {
    const short = row.day.slice(0, 3);
    const prev = out[out.length - 1];
    if (prev && prev.time === row.text) {
      prev.last = short;
      prev.days = `${prev.first} — ${short}`;
    } else {
      out.push({
        days: short,
        time: row.text,
        open: row.text !== "Closed",
        first: short,
        last: short,
      });
    }
  }
  return out.map(({ days, time, open }) => ({ days, time, open }));
}

/** "$35" or "from $35" when barbers charge differently. */
export function price(fromCents: number, toCents: number): string {
  const f = `$${Math.round(fromCents / 100)}`;
  return toCents > fromCents ? `from ${f}` : f;
}
