import "server-only";
import type { SiteData } from "@lineup/site-kit";
import { NextResponse } from "next/server";

export function siteResponse(site: SiteData | null) {
  if (!site) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(site, {
    headers: {
      // Shops change menus rarely; a minute of edge caching keeps sites fast.
      "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
