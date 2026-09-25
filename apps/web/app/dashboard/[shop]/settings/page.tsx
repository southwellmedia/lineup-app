import type { Metadata } from "next";
import { headers } from "next/headers";
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
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (
    <HydrateClient>
      <SettingsForm />
      <TextsCard webhookUrl={`${proto}://${host}/api/webhooks/twilio`} />
      <ConnectionsCard />
    </HydrateClient>
  );
}
