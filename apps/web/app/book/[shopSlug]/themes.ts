import type { CSSProperties } from "react";

/**
 * Booking page themes that match a shop's website template. Each swaps the
 * booking flow's design tokens, so the flow itself doesn't change.
 */
export type BookingTheme = {
  className: string;
  style: CSSProperties;
  /** Web fonts the theme needs. */
  fonts?: string;
};

const CONTACT_SHEET: BookingTheme = {
  className: "theme-contact-sheet",
  fonts:
    "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@300;600;800;900&family=DM+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300;1,6..72,400&display=swap",
  style: {
    // Dark film stock, paper text; the "brand" accent becomes paper too.
    "--color-paper": "#0e0e0e",
    "--color-card": "#171717",
    "--color-ink": "#f2f0eb",
    "--color-muted": "#9a978f",
    "--color-line": "#2e2e2e",
    "--color-danger": "oklch(0.7 0.17 28)",
    "--brand": "#f2f0eb",
    "--brand-ink": "#0e0e0e",
    "--color-brand": "#f2f0eb",
    "--color-brand-ink": "#0e0e0e",
    "--font-display": '"Big Shoulders Display", "Arial Narrow", sans-serif',
    "--font-sans": '"Newsreader", Georgia, serif',
    "--font-serif": '"Newsreader", Georgia, serif',
  } as CSSProperties,
};

export function bookingTheme(template: string | null | undefined): BookingTheme | null {
  return template === "contact-sheet" ? CONTACT_SHEET : null;
}
