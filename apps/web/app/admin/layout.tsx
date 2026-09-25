import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { isPlatformAdmin } from "@/lib/admin/platform";
import { createUserClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: "Admin · Lineup",
  robots: { index: false, follow: false },
};

/** Lineup's own back office. Anyone else gets a 404, not a hint it exists. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { data } = await (await createUserClient()).auth.getClaims();
  if (!data) redirect("/login?next=/admin");
  if (!(await isPlatformAdmin(data.claims.sub))) notFound();
  const email = typeof data.claims.email === "string" ? data.claims.email : "";

  return (
    <div className="app-ui">
      <header className="sticky top-0 z-20 bg-sidebar text-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo compact />
            <span className="rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-brand-ink">
              Admin
            </span>
          </div>
          <AdminNav />
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden truncate text-paper/60 sm:inline">{email}</span>
            <Link href="/dashboard" className="font-semibold text-paper/80 hover:text-paper">
              Dashboard →
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">{children}</main>
    </div>
  );
}
