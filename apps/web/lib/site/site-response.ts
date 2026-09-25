import "server-only";
import type { SiteData } from "@lineup/site-kit";
import { NextResponse } from "next/server";

/**
 * Site data is never cached here. The shop sites cache their rendered pages
 * at the CDN, tagged by shop, and the database purges that tag on every
 * change; a second cache in front of this API would only serve stale data
 * to those fresh renders.
 */
export function siteResponse(site: SiteData | null) {
  if (!site) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(site, { headers: { "cache-control": "no-store" } });
}
