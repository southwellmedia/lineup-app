import "server-only";
import type { Database } from "@lineup/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let admin: SupabaseClient<Database> | undefined;

/**
 * Server-only client with the secret key. It bypasses row-level security,
 * so use it only in procedures that do their own authorization, such as
 * public booking. Never import this from client code.
 */
export function adminClient(): SupabaseClient<Database> {
  if (!admin) {
    const env = serverEnv();
    admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
