import type { Route } from "next";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin/platform";
import { createUserClient } from "@/lib/supabase/server";
import { serverCaller } from "@/trpc/server";

/** Sends staff to their first shop; explains what to do if they have none. */
export default async function DashboardIndex() {
  const shops = await (await serverCaller()).me.shops();
  const first = shops[0];
  if (first) redirect(`/dashboard/${first.slug}` as Route);
  const { data } = await (await createUserClient()).auth.getClaims();
  if (await isPlatformAdmin(data?.claims.sub ?? null)) redirect("/admin");

  return (
    <main className="app-ui mx-auto flex max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-bold tracking-tight">No shop yet</h1>
      <p className="mt-3 text-muted">
        You&apos;re signed in, but this email isn&apos;t on any shop&apos;s team. Ask the owner to
        invite you with this email, then sign in again.
      </p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button type="submit" className="font-semibold underline underline-offset-4">
          Sign out
        </button>
      </form>
    </main>
  );
}
