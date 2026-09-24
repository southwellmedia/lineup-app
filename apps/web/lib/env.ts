import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required on the server"),
});

/**
 * Public values are inlined at build time, so they must be read with
 * literal `process.env.NEXT_PUBLIC_*` references.
 */
export function publicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** Server-only values. Validated on first use so builds don't need secrets. */
export function serverEnv() {
  return serverSchema.parse({
    ...publicEnv(),
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}

/**
 * Origin of the shop websites app (apps/sites), e.g.
 * https://lineup-sites-southwell-media.vercel.app. Optional: without it the
 * dashboard can't link to a shop's site.
 */
export function sitesUrl(): string | null {
  const value = process.env.SITES_URL?.trim();
  return value && z.string().url().safeParse(value).success ? value : null;
}
