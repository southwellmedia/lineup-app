import { isTemplateId } from "@lineup/site-kit";
import type { NextRequest } from "next/server";
import { loadSiteData } from "@/lib/site/site-data";
import { siteResponse } from "@/lib/site/site-response";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Public, read-only website data for a shop, by booking slug. `?preview=1`
 * skips caching (the dashboard's live preview) and may ask for another
 * `template`'s saved content.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const query = request.nextUrl.searchParams;
  const preview = query.get("preview") === "1";
  const template = query.get("template");
  const site = await loadSiteData(adminClient(), { slug }, request.nextUrl.origin, {
    template: preview && isTemplateId(template) ? template : undefined,
  });
  return siteResponse(site);
}
