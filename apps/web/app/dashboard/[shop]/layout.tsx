import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ShopProvider } from "@/components/shop-context";
import { isPlatformAdmin } from "@/lib/admin/platform";
import { createUserClient } from "@/lib/supabase/server";
import { serverCaller } from "@/trpc/server";
import { Shell } from "./shell";

type Props = { children: ReactNode; params: Promise<{ shop: string }> };

/** Resolves the shop from the URL. Non-members get a 404, not a hint the shop exists. */
export default async function ShopLayout({ children, params }: Props) {
  const { shop: slug } = await params;
  const [shops, claims] = await Promise.all([
    (await serverCaller()).me.shops(),
    (await createUserClient()).auth.getClaims(),
  ]);
  const shop = shops.find((s) => s.slug === slug);
  if (!shop || !shop.staffId) notFound();

  const email = typeof claims.data?.claims.email === "string" ? claims.data.claims.email : "";
  const admin = await isPlatformAdmin(claims.data?.claims.sub ?? null);

  return (
    <ShopProvider
      value={{
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        timezone: shop.timezone,
        role: shop.role,
        staffId: shop.staffId,
        isManager: shop.role === "owner" || shop.role === "manager",
      }}
    >
      <Shell
        email={email}
        admin={admin}
        shops={shops.map((s) => ({ slug: s.slug, name: s.name, plan: s.plan }))}
      >
        {children}
      </Shell>
    </ShopProvider>
  );
}
