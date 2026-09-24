import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { viewerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { MemberDetail } from "./member-detail";

export const metadata: Metadata = { title: "Team member · Lineup" };

type Props = { params: Promise<{ shop: string; staffId: string }> };

export default async function MemberPage({ params }: Props) {
  const { shop: slug, staffId } = await params;
  const shop = await viewerShop(slug);
  // Barbers can only open their own page ("My hours").
  if (!shop.isManager && staffId !== shop.staffId) notFound();
  if (!/^[0-9a-f-]{36}$/.test(staffId)) notFound();

  await getQueryClient().prefetchQuery(trpc.team.detail.queryOptions({ shopId: shop.id, staffId }));
  return (
    <HydrateClient>
      <MemberDetail staffId={staffId} />
    </HydrateClient>
  );
}
