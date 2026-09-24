import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, referrerOf, sitePath } from "@/lib/analytics/event";
import { recordSiteEvent } from "@/lib/analytics/record";
import { adminClient } from "@/lib/supabase/admin";

const body = z.object({
  kind: z.enum(["pageview", "book_click"]),
  path: z.string().max(500),
  referrer: z.string().max(1000).optional(),
  utmSource: z.string().max(100).optional(),
  host: z.string().max(253).optional(),
});

/** slug → shop id, briefly cached per server instance. */
const shops = new Map<string, { id: string | null; at: number }>();
async function shopId(slug: string): Promise<string | null> {
  const hit = shops.get(slug);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.id;
  const { data } = await adminClient().from("shops").select("id").eq("slug", slug).maybeSingle();
  shops.set(slug, { id: data?.id ?? null, at: Date.now() });
  return data?.id ?? null;
}

/**
 * Page views and Book clicks from a shop website. Called server-to-server by
 * apps/sites, which passes the visitor's IP and user agent along. Always
 * answers 204 so a tracking hiccup never surfaces to visitors.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  const id = parsed.success ? await shopId(slug) : null;
  if (parsed.success && id) {
    const e = parsed.data;
    await recordSiteEvent({
      shopId: id,
      kind: e.kind,
      path: sitePath(e.path, slug),
      referrer: referrerOf(e.referrer, e.utmSource, e.host ? [e.host] : []),
      ip:
        request.headers.get("x-lineup-client-ip") ??
        clientIp(request.headers.get("x-forwarded-for")),
      userAgent:
        request.headers.get("x-lineup-client-ua") ?? request.headers.get("user-agent") ?? "",
    });
  }
  return new NextResponse(null, { status: 204 });
}
