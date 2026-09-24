import type { Metadata } from "next";
import { managerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { WebsiteOverview } from "./website-overview";

export const metadata: Metadata = { title: "Website · Lineup" };

export default async function WebsitePage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await managerShop((await params).shop);
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.website.overview.queryOptions({ shopId: shop.id })),
    queryClient.prefetchQuery(trpc.website.analytics.queryOptions({ shopId: shop.id, days: 30 })),
  ]);
  return (
    <HydrateClient>
      <WebsiteOverview />
    </HydrateClient>
  );
}
