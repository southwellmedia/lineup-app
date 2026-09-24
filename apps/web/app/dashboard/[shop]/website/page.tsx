import type { Metadata } from "next";
import { managerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { WebsiteOverview } from "./website-overview";

export const metadata: Metadata = { title: "Website · Lineup" };

export default async function WebsitePage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await managerShop((await params).shop);
  await getQueryClient().prefetchQuery(trpc.website.overview.queryOptions({ shopId: shop.id }));
  return (
    <HydrateClient>
      <WebsiteOverview />
    </HydrateClient>
  );
}
