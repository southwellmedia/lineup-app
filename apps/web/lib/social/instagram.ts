import { z } from "zod";

/** "@southside.cuts", "instagram.com/southside.cuts/" → "southside.cuts". Blank → null. */
export const instagramHandle = z
  .string()
  .trim()
  .transform((v) =>
    v
      .replace(/^@/, "")
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/[/?#].*$/, ""),
  )
  .refine(
    (v) => v === "" || /^[A-Za-z0-9._]{1,30}$/.test(v),
    "Use just the handle, like southsidecuts.",
  )
  .transform((v) => v || null);
