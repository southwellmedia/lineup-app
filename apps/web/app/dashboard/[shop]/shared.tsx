"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";

/* Pieces shared by the Today board and the calendar. */

/** The current time in ms, refreshed every `ms` (for live chair timers). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function BarberAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-brand font-display font-black uppercase text-brand-ink ring-2 ring-paper/20 ${
        size === "lg" ? "size-12 text-2xl" : "size-9 text-lg"
      }`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

const TIP_PRESETS = [0, 500, 1000];

export function PayPanel(props: {
  appointmentId: string;
  balanceDueCents: number;
  onClose: () => void;
  onPaid: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const [method, setMethod] = useState<"cash" | "external">("cash");
  const [amount, setAmount] = useState((props.balanceDueCents / 100).toFixed(2));
  const [tip, setTip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const markPaid = useMutation(trpc.appointments.markPaid.mutationOptions());

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setError("Enter an amount like 35.00");
      return;
    }
    try {
      await markPaid.mutateAsync({
        appointmentId: props.appointmentId,
        method,
        amountCents: cents,
        tipCents: tip,
      });
      await props.onPaid();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-dashed border-line pt-3">
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Paid with</legend>
        <div className="flex gap-2">
          {(
            [
              ["cash", "Cash"],
              ["external", "Cash App / Zelle / other"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-semibold has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
            >
              <input
                type="radio"
                name="method"
                value={value}
                checked={method === value}
                onChange={() => setMethod(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label
            htmlFor={`amount-${props.appointmentId}`}
            className="mb-1.5 block text-sm font-semibold"
          >
            Amount
          </label>
          <div className="flex items-center rounded-xl border border-line bg-paper px-3 focus-within:border-ink">
            <span className="text-muted">$</span>
            <input
              id={`amount-${props.appointmentId}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 bg-transparent px-1 py-2 text-lg font-semibold tabular-nums outline-none"
            />
          </div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Tip</legend>
          <div className="flex gap-1.5">
            {TIP_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tip === t}
                onClick={() => setTip(t)}
                className="rounded-full border border-line px-3 py-2 text-sm font-semibold tabular-nums aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-brand-ink"
              >
                {t === 0 ? "None" : formatCents(t).replace(".00", "")}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <ActionButton primary type="submit" disabled={markPaid.isPending}>
          {markPaid.isPending
            ? "Saving…"
            : `Record ${formatCents(Math.round(Number(amount) * 100) + tip || 0)}`}
        </ActionButton>
        <ActionButton onClick={props.onClose}>Cancel</ActionButton>
      </div>
    </form>
  );
}

export function ActionButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const style = props.primary
    ? "bg-ink text-paper border-ink hover:bg-brand hover:border-brand hover:text-brand-ink"
    : props.danger
      ? "border-danger text-danger hover:bg-danger hover:text-paper"
      : "border-line bg-card hover:border-ink";
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 ${style}`}
    >
      {props.children}
    </button>
  );
}
