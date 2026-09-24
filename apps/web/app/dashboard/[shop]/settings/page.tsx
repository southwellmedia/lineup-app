import type { Metadata } from "next";
import { managerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings · Lineup" };

export default async function SettingsPage({ params }: { params: Promise<{ shop: string }> }) {
  const shop = await managerShop((await params).shop);
  await getQueryClient().prefetchQuery(trpc.settings.get.queryOptions({ shopId: shop.id }));
  return (
    <HydrateClient>
      <SettingsForm />
    </HydrateClient>
  );
}
