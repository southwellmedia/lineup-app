import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Lineup" };

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <div aria-hidden className="pole mb-8 h-3 w-20 animate-pole rounded-full ring-2 ring-ink" />
      <p className="font-serif text-xl text-muted">For barbers and shop owners</p>
      <h1 className="mb-8 font-display text-6xl font-black uppercase leading-[0.85] tracking-tight">
        Sign in
      </h1>
      {error ? (
        <p
          role="alert"
          className="mb-6 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
        >
          That sign-in link didn&apos;t work or has expired. Request a new one.
        </p>
      ) : null}
      <LoginForm next={next?.startsWith("/") ? next : "/dashboard"} />
    </main>
  );
}
