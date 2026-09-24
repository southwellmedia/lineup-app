import { Big_Shoulders, Instrument_Sans, Instrument_Serif } from "next/font/google";

/** Condensed signage face for headings. */
export const display = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  // Next has no fallback metrics for this family; skip the size-adjusted fallback.
  adjustFontFallback: false,
});

export const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/** Italic accents: "with Marcus", "see you soon". */
export const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
});
