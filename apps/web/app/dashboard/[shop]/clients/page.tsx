import type { Metadata } from "next";
import { viewerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ClientList } from "./client-list";

export const metadata: Metadata = { title: "Clients · Lineup" };

export default async function ClientsPage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await viewerShop((await params).shop);
  await getQueryClient().prefetchQuery(
    trpc.clients.list.queryOptions({ shopId: shop.id, search: "" }),
  );
  return (
    <HydrateClient>
      <ClientList />
    </HydrateClient>
  );
}
