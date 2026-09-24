import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createUserClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard · Lineup" };

/** Everything under /dashboard needs a signed-in user. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { data } = await (await createUserClient()).auth.getClaims();
  if (!data) redirect("/login?next=/dashboard");
  return children;
}
