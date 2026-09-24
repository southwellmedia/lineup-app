import { NextResponse, type NextRequest } from "next/server";
import { loadSiteData } from "@/lib/site/site-data";
import { adminClient } from "@/lib/supabase/admin";
import { siteResponse } from "@/lib/site/site-response";

/** Public website data for the shop that owns a custom domain: /api/public/sites?domain=southsidecuts.com */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams
    .get("domain")
    ?.trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (!domain || !/^[a-z0-9.-]{3,253}$/.test(domain)) {
    return NextResponse.json({ error: "domain_required" }, { status: 400 });
  }
  return siteResponse(await loadSiteData(adminClient(), { domain }, request.nextUrl.origin));
}
