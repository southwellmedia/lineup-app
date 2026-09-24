"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm({ next }: { next: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [email, setEmail] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    const { error } = await createBrowserSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString() },
    });
    setStatus(error ? "error" : "sent");
  };

  if (status === "sent") {
    return (
      <div
        role="status"
        className="animate-rise rounded-2xl border border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]"
      >
        <p className="font-display text-2xl font-bold uppercase">Check your email</p>
        <p className="mt-1 text-muted">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Open it
          on this device.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-semibold underline underline-offset-4"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-lg outline-none transition-colors focus:border-ink focus-visible:ring-2 focus-visible:ring-brand/40"
        />
      </div>
      {status === "error" ? (
        <p role="alert" className="text-sm font-medium text-danger">
          We couldn&apos;t send the link. Wait a minute and try again.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-full bg-brand px-7 py-3.5 font-semibold text-brand-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="text-sm text-muted">No password needed. Use the email your shop invited.</p>
    </form>
  );
}
