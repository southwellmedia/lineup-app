import type { Metadata } from "next";
import { managerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, serverCaller, trpc } from "@/trpc/server";
import { DesignEditor } from "./design-editor";

export const metadata: Metadata = { title: "Design · Website · Lineup" };

export default async function DesignPage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await managerShop((await params).shop);
  const [overview] = await Promise.all([
    (await serverCaller()).website.overview({ shopId: shop.id }),
    getQueryClient().prefetchQuery(trpc.website.design.queryOptions({ shopId: shop.id })),
  ]);
  return (
    <HydrateClient>
      <DesignEditor siteUrl={overview.url} />
    </HydrateClient>
  );
}
