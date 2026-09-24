"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ShopContextValue = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  role: "owner" | "manager" | "barber";
  staffId: string;
  isManager: boolean;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({
  value,
  children,
}: {
  value: ShopContextValue;
  children: ReactNode;
}) {
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

/** The shop the dashboard is showing, and the viewer's role in it. */
export function useShop(): ShopContextValue {
  const shop = useContext(ShopContext);
  if (!shop) throw new Error("useShop() must be used inside the dashboard");
  return shop;
}
