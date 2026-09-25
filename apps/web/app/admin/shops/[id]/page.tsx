import { TRPCError } from "@trpc/server";
import { notFound } from "next/navigation";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ShopDetail } from "./shop-detail";

export const metadata = { title: "Shop · Lineup admin" };

export default async function AdminShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    await getQueryClient().fetchQuery(trpc.admin.shop.queryOptions({ shopId: id }));
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <HydrateClient>
      <ShopDetail shopId={id} />
    </HydrateClient>
  );
}
