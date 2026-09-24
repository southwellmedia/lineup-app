import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQueryClient, HydrateClient, serverCaller, trpc } from "@/trpc/server";
import { BookingFlow, type PublicSource } from "./booking-flow";

type Props = {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
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
  const { src } = await searchParams;
  const menu = await loadShop(shopSlug);

  // Seed the client cache so the flow renders instantly without refetching.
  getQueryClient().setQueryData(trpc.booking.shop.queryKey({ slug: shopSlug }), menu);
  const source = (typeof src === "string" && SOURCES[src.toLowerCase()]) || "booking_link";

  return (
    <main className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
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
        <BookingFlow slug={shopSlug} source={source} />
      </HydrateClient>
    </main>
  );
}
