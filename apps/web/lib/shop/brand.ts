/** Default accent when a shop hasn't picked one: barber-pole red. */
export const DEFAULT_BRAND = "#C0312B";

const INK = "#1c1714";
const PAPER = "#fdfbf7";

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Text color (ink or paper) with the better WCAG contrast on the brand color. */
export function brandInk(hex: string): string {
  const l = luminance(hex);
  return contrast(l, luminance(INK)) >= contrast(l, luminance(PAPER)) ? INK : PAPER;
}

/**
 * CSS variables that theme a page with the shop's brand. Tailwind's
 * `--color-brand` is resolved where it's declared (:root), so overriding
 * `--brand` alone on a subtree wouldn't reach `bg-brand` and friends; set
 * both layers.
 */
export function brandStyle(hex: string | null | undefined): Record<string, string> {
  const color = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_BRAND;
  const ink = brandInk(color);
  return { "--brand": color, "--brand-ink": ink, "--color-brand": color, "--color-brand-ink": ink };
}
