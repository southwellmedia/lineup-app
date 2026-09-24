import type { Metadata } from "next";
import { managerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ServicesManager } from "./services-manager";

export const metadata: Metadata = { title: "Services · Lineup" };

export default async function ServicesPage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await managerShop((await params).shop);
  await getQueryClient().prefetchQuery(trpc.services.list.queryOptions({ shopId: shop.id }));
  return (
    <HydrateClient>
      <ServicesManager />
    </HydrateClient>
  );
}
