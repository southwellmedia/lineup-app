import type { Database } from "@lineup/db";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Browser client for auth flows and direct uploads to Storage (guarded by
 * storage RLS). Everything else goes through tRPC.
 */
export function createBrowserSupabase() {
  const env = publicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
