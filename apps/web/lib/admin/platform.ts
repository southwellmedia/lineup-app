import "server-only";
import type { Json } from "@lineup/db";
import { cache } from "react";
import { adminClient } from "@/lib/supabase/admin";

/** Whether this user runs Lineup itself. Cached per request. */
export const isPlatformAdmin = cache(async (userId: string | null): Promise<boolean> => {
  if (!userId) return false;
  const { data, error } = await adminClient()
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
});

/** Records an admin's change. Throws if it can't, so no change goes unlogged. */
export async function audit(entry: {
  adminUserId: string;
  action: string;
  shopId?: string | null;
  detail?: Record<string, Json | undefined>;
}): Promise<void> {
  const { error } = await adminClient()
    .from("admin_audit_log")
    .insert({
      admin_user_id: entry.adminUserId,
      action: entry.action,
      shop_id: entry.shopId ?? null,
      detail: (entry.detail ?? {}) as Json,
    });
  if (error) throw error;
}
