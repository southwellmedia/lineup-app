import type { NextRequest } from "next/server";
import { loadSiteData } from "@/lib/site/site-data";
import { siteResponse } from "@/lib/site/site-response";
import { adminClient } from "@/lib/supabase/admin";

/** Public, read-only website data for a shop, by booking slug. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return siteResponse(await loadSiteData(adminClient(), { slug }, request.nextUrl.origin));
}
