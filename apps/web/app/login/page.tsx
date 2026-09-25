import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Lineup" };

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  return (
    <div className="app-ui flex flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8" />
      <main className="w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-[0_1px_2px_oklch(0_0_0/0.03)] sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="mb-6 mt-1 text-muted">For barbers and shop owners</p>
        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            That sign-in link didn&apos;t work or has expired. Request a new one.
          </p>
        ) : null}
        <LoginForm next={next?.startsWith("/") ? next : "/dashboard"} />
      </main>
    </div>
  );
}
