import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { viewerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ClientProfile } from "./client-profile";

export const metadata: Metadata = { title: "Client · Lineup" };

type Props = { params: Promise<{ shop: string; clientId: string }> };

export default async function ClientPage({ params }: Props) {
  const { shop: slug, clientId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(clientId)) notFound();
  const shop = await viewerShop(slug);
  try {
    await getQueryClient().fetchQuery(
      trpc.clients.detail.queryOptions({ shopId: shop.id, clientId }),
    );
  } catch {
    notFound(); // not visible to this viewer, or doesn't exist
  }
  return (
    <HydrateClient>
      <ClientProfile clientId={clientId} />
    </HydrateClient>
  );
}
