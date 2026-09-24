/**
 * Owners paste whatever Google or Meta showed them: a bare id, a full
 * snippet, or a meta tag. These pull out the one value we store, or return
 * null if there's nothing valid in it. Blank input means "remove".
 */

export type Parsed = { value: string | null } | { error: string };

export function parseGa4(input: string): Parsed {
  const text = input.trim();
  if (!text) return { value: null };
  const match = /\bG-[A-Z0-9]{6,12}\b/i.exec(text);
  return match
    ? { value: match[0].toUpperCase() }
    : { error: "Use your GA4 measurement ID, like G-AB12CD34EF." };
}

export function parseMetaPixel(input: string): Parsed {
  const text = input.trim();
  if (!text) return { value: null };
  // A pasted snippet contains fbq('init', '123...'); a bare id is just digits.
  const match =
    /fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/.exec(text) ?? /^(\d{10,20})$/.exec(text);
  return match?.[1]
    ? { value: match[1] }
    : { error: "Use your Pixel ID: the 15–16 digit number in Events Manager." };
}

export function parseSiteVerification(input: string): Parsed {
  const text = input.trim();
  if (!text) return { value: null };
  const fromTag = /content\s*=\s*["']([A-Za-z0-9_-]{20,100})["']/.exec(text)?.[1];
  const token = fromTag ?? (/^[A-Za-z0-9_-]{20,100}$/.test(text) ? text : null);
  return token
    ? { value: token }
    : { error: "Paste the HTML tag from Search Console, or just its content value." };
}
