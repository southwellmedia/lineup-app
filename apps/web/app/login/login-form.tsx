"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Button, Field, Input } from "@/components/ui";

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
      <div role="status" className="animate-rise">
        <p className="text-lg font-semibold tracking-tight">Check your email</p>
        <p className="mt-1 text-muted">
          We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Open it
          on this device.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourshop.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {status === "error" ? (
        <p role="alert" className="text-sm font-medium text-danger">
          We couldn&apos;t send the link. Wait a minute and try again.
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="w-full" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </Button>
      <p className="text-sm text-muted">No password needed. Use the email your shop invited.</p>
    </form>
  );
}
