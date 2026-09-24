/**
 * Normalizes a phone number to E.164. Bare 10-digit numbers are treated as
 * US/Canada (+1), which covers our DFW launch market. Returns null when the
 * input can't be a valid number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else return null;

  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}
