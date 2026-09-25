import type { Metadata } from "next";
import { managerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ConnectionsCard } from "./connections-card";
import { SettingsForm } from "./settings-form";
import { TextsCard } from "./texts-card";

export const metadata: Metadata = { title: "Settings · Lineup" };

export default async function SettingsPage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await managerShop((await params).shop);
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trpc.settings.get.queryOptions({ shopId: shop.id })),
    queryClient.prefetchQuery(trpc.settings.texts.queryOptions({ shopId: shop.id })),
  ]);
  return (
    <HydrateClient>
      <SettingsForm />
      <TextsCard />
      <ConnectionsCard />
    </HydrateClient>
  );
}
