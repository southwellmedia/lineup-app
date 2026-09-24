import type { Metadata } from "next";
import { managerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { TeamList } from "./team-list";

export const metadata: Metadata = { title: "Team · Lineup" };

export default async function TeamPage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await managerShop((await params).shop);
  await getQueryClient().prefetchQuery(trpc.team.list.queryOptions({ shopId: shop.id }));
  return (
    <HydrateClient>
      <TeamList />
    </HydrateClient>
  );
}
