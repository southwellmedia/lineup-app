import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { brandStyle } from "@lineup/site-kit";
import { clientIp, referrerOf } from "@/lib/analytics/event";
import { recordSiteEvent } from "@/lib/analytics/record";
import { getQueryClient, HydrateClient, serverCaller, trpc } from "@/trpc/server";
import { BookingFlow, type PublicSource } from "./booking-flow";

type Props = {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{
    src?: string | string[];
    service?: string | string[];
    barber?: string | string[];
  }>;
};

/** `?src=` values a shop can put on its links, for attribution. */
const SOURCES: Record<string, PublicSource> = {
  instagram: "instagram",
  ig: "instagram",
  google: "google",
  website: "website",
  site: "website",
  referral: "referral",
};

async function loadShop(slug: string) {
  try {
    return await (await serverCaller()).booking.shop({ slug });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shopSlug } = await params;
  const { shop } = await loadShop(shopSlug);
  return { title: `Book at ${shop.name}` };
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { shopSlug } = await params;
  const { src, service, barber } = await searchParams;
  const uuid = (v: unknown) =>
    typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined;
  const menu = await loadShop(shopSlug);

  // Seed the client cache so the flow renders instantly without refetching.
  getQueryClient().setQueryData(trpc.booking.shop.queryKey({ slug: shopSlug }), menu);
  const source = (typeof src === "string" && SOURCES[src.toLowerCase()]) || "booking_link";

  // Count the visit after the response is sent, so it never slows the page.
  const h = await headers();
  after(() =>
    recordSiteEvent({
      shopId: menu.shop.id,
      kind: "booking_view",
      path: `/book/${shopSlug}`,
      referrer: referrerOf(h.get("referer") ?? undefined, undefined, [h.get("host") ?? ""]),
      source,
      ip: clientIp(h.get("x-forwarded-for")),
      userAgent: h.get("user-agent") ?? "",
    }),
  );

  return (
    // The shop's brand color themes every accent on the page.
    <main
      className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12"
      style={brandStyle(menu.shop.brandColor)}
    >
      <header className="mb-10 flex items-end justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Book online</p>
          <h1 className="font-display text-5xl font-black uppercase leading-[0.85] tracking-tight sm:text-6xl">
            {menu.shop.name}
          </h1>
        </div>
        <div
          aria-hidden
          className="pole h-14 w-3 shrink-0 animate-pole rounded-full ring-2 ring-ink"
        />
      </header>
      <HydrateClient>
        <BookingFlow
          slug={shopSlug}
          source={source}
          preselect={{
            serviceIds:
              typeof service === "string"
                ? service
                    .split(",")
                    .slice(0, 10)
                    .flatMap((id) => uuid(id) ?? [])
                : [],
            barberId: uuid(barber),
          }}
        />
      </HydrateClient>
    </main>
  );
}
