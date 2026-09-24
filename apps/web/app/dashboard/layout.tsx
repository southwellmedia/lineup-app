import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createUserClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard · Lineup" };

/** Everything under /dashboard needs a signed-in staff member. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect("/login?next=/dashboard");
  const email = typeof data.claims.email === "string" ? data.claims.email : "";

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="pole h-6 w-2 animate-pole rounded-full ring-1 ring-paper/40"
            />
            <span className="font-display text-2xl font-black uppercase tracking-tight">
              Lineup
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-paper/60 sm:inline">{email}</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-paper/30 px-3 py-1.5 font-medium hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
