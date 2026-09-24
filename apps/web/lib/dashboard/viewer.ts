import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { serverCaller } from "@/trpc/server";

/** The shop at `slug` and the viewer's role in it. 404s for non-members. Cached per request. */
export const viewerShop = cache(async (slug: string) => {
  const shop = (await (await serverCaller()).me.shops()).find((s) => s.slug === slug);
  if (!shop || !shop.staffId) notFound();
  return {
    ...shop,
    staffId: shop.staffId,
    isManager: shop.role === "owner" || shop.role === "manager",
  };
});

/** For owner/manager-only pages. Barbers get a 404 rather than a broken page. */
export async function managerShop(slug: string) {
  const shop = await viewerShop(slug);
  if (!shop.isManager) notFound();
  return shop;
}
