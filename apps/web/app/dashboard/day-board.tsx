"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatTime } from "@/lib/booking/slots";
import { formatPhone, sourceLabel, STATUS_LABEL, summarizeDay } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";

type Day = inferRouterOutputs<AppRouter>["schedule"]["day"];
type Appointment = Day["appointments"][number];

function dayHref(shopId: string, date: string): Route {
  return `/dashboard?shop=${shopId}&date=${date}` as Route;
}

export function DayBoard(props: {
  shopId: string;
  date: string;
  today: string;
  shops: { id: string; name: string; slug: string }[];
}) {
  const trpc = useTRPC();
  const { data: day } = useSuspenseQuery(
    trpc.schedule.day.queryOptions({ shopId: props.shopId, date: props.date }),
  );
  const isManager = day.viewer.role === "owner" || day.viewer.role === "manager";
  const [barber, setBarber] = useState<string>("all");

  const visible = day.appointments.filter((a) => barber === "all" || a.staffId === barber);
  const summary = summarizeDay(visible);
  const d = DateTime.fromISO(props.date);
  const staffName = (id: string) => day.staff.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      {/* Shop + date */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          {props.shops.length > 1 ? (
            <nav aria-label="Shops" className="mb-1 flex flex-wrap gap-2 text-sm">
              {props.shops.map((s) => (
                <Link
                  key={s.id}
                  href={dayHref(s.id, props.date)}
                  aria-current={s.id === props.shopId ? "page" : undefined}
                  className="rounded-full border border-line px-3 py-1 aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
                >
                  {s.name}
                </Link>
              ))}
            </nav>
          ) : (
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              {day.shop.name}
            </p>
          )}
          <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight">
            {props.date === props.today ? "Today" : d.toFormat("cccc")}
            <span className="ml-3 font-serif text-2xl font-normal normal-case text-muted">
              {d.toFormat("LLLL d")}
            </span>
          </h1>
        </div>
        <nav aria-label="Change day" className="flex items-center gap-1.5">
          <DayLink
            href={dayHref(props.shopId, d.minus({ days: 1 }).toISODate() ?? props.date)}
            label="Previous day"
          >
            ←
          </DayLink>
          {props.date !== props.today ? (
            <Link
              href={dayHref(props.shopId, props.today)}
              className="rounded-full border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper"
            >
              Today
            </Link>
          ) : null}
          <DayLink
            href={dayHref(props.shopId, d.plus({ days: 1 }).toISODate() ?? props.date)}
            label="Next day"
          >
            →
          </DayLink>
        </nav>
      </div>

      {/* Totals */}
      <dl className="mb-6 grid grid-cols-3 gap-2.5">
        <Stat label="Booked" value={String(summary.booked)} />
        <Stat label="Expected" value={formatCents(summary.expectedCents)} />
        <Stat
          label="Collected"
          value={formatCents(summary.collectedCents)}
          note={summary.tipsCents ? `+${formatCents(summary.tipsCents)} tips` : undefined}
          highlight
        />
      </dl>

      {/* Barber filter (owners and managers) */}
      {isManager && day.staff.length > 1 ? (
        <div
          role="radiogroup"
          aria-label="Barber"
          className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {[{ id: "all", name: "Everyone" }, ...day.staff].map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={barber === s.id}
              onClick={() => setBarber(s.id)}
              className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold aria-checked:border-ink aria-checked:bg-ink aria-checked:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-display text-2xl font-bold uppercase">Open book</p>
          <p className="mt-1 text-muted">No appointments this day yet.</p>
          <Link
            href={`/book/${day.shop.slug}` as Route}
            className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
          >
            Open your booking page
          </Link>
        </div>
      ) : (
        <ol className="space-y-3">
          {visible.map((appt, i) => (
            <li
              key={appt.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <AppointmentCard
                appt={appt}
                timezone={day.shop.timezone}
                barberName={isManager && day.staff.length > 1 ? staffName(appt.staffId) : null}
                queryKey={trpc.schedule.day.pathKey()}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DayLink({ href, label, children }: { href: Route; label: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full border border-line bg-card text-lg hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </Link>
  );
}

function Stat({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${highlight ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}
    >
      <dt
        className={`text-xs font-semibold uppercase tracking-wider ${highlight ? "text-paper/60" : "text-muted"}`}
      >
        {label}
      </dt>
      <dd className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</dd>
      {note ? <dd className="text-xs text-paper/70">{note}</dd> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-paper text-ink ring-1 ring-line",
  checked_in: "bg-brand text-brand-ink",
  completed: "bg-ink text-paper",
  cancelled: "bg-line text-muted line-through",
  no_show: "bg-danger/15 text-danger",
};

type Panel = "none" | "pay" | "more" | "cancel";

function AppointmentCard(props: {
  appt: Appointment;
  timezone: string;
  barberName: string | null;
  queryKey: readonly unknown[];
}) {
  const { appt } = props;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<Panel>("none");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: props.queryKey });
  const onError = (e: { message: string }) => setError(e.message);
  const onDone = async () => {
    setError(null);
    setPanel("none");
    await refresh();
  };

  const checkIn = useMutation(
    trpc.appointments.checkIn.mutationOptions({ onSuccess: onDone, onError }),
  );
  const noShow = useMutation(
    trpc.appointments.markNoShow.mutationOptions({ onSuccess: onDone, onError }),
  );
  const cancel = useMutation(
    trpc.appointments.cancel.mutationOptions({ onSuccess: onDone, onError }),
  );

  const inactive = appt.status === "cancelled" || appt.status === "no_show";
  const live = appt.status === "confirmed" || appt.status === "checked_in";
  const canPay = (live || appt.status === "completed") && appt.balanceDueCents > 0;
  const busy = checkIn.isPending || noShow.isPending || cancel.isPending;

  return (
    <article
      className={`rounded-2xl border bg-card p-4 transition-colors ${
        appt.status === "checked_in"
          ? "border-brand shadow-[4px_4px_0_0_var(--color-brand)]"
          : "border-line"
      } ${inactive ? "opacity-60" : ""}`}
    >
      <div className="flex gap-4">
        <div className="w-20 shrink-0">
          <p className="font-display text-2xl font-extrabold leading-none tabular-nums">
            {formatTime(appt.startsAt, props.timezone).replace(" ", " ")}
          </p>
          <p className="mt-1 text-xs text-muted">to {formatTime(appt.endsAt, props.timezone)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{appt.client?.name ?? "Client"}</p>
              {appt.client ? (
                <a
                  href={`tel:${appt.client.phone}`}
                  className="text-sm text-muted underline-offset-4 hover:underline"
                >
                  {formatPhone(appt.client.phone)}
                </a>
              ) : null}
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[appt.status] ?? ""}`}
            >
              {STATUS_LABEL[appt.status]}
            </span>
          </div>

          <p className="mt-2">{appt.services.join(" + ")}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
            {props.barberName ? <span>with {props.barberName}</span> : null}
            <span>via {sourceLabel(appt.source)}</span>
            <span className="font-medium text-ink tabular-nums">
              {appt.balanceDueCents === 0 && appt.paidCents > 0
                ? `Paid ${formatCents(appt.paidCents)}${appt.tipCents ? ` + ${formatCents(appt.tipCents)} tip` : ""}`
                : appt.paidCents > 0
                  ? `${formatCents(appt.balanceDueCents)} due`
                  : formatCents(appt.priceCents)}
            </span>
          </p>
          {appt.note ? (
            <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-sm">
              <span className="font-serif text-muted">Note: </span>
              {appt.note}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}

      {/* Actions */}
      {(live || canPay) && panel === "none" ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-line pt-3">
          {appt.status === "confirmed" ? (
            <ActionButton
              primary
              disabled={busy}
              onClick={() => checkIn.mutate({ appointmentId: appt.id })}
            >
              Check in
            </ActionButton>
          ) : null}
          {canPay ? (
            <ActionButton
              primary={appt.status !== "confirmed"}
              disabled={busy}
              onClick={() => setPanel("pay")}
            >
              Mark paid
            </ActionButton>
          ) : null}
          {live ? (
            <ActionButton disabled={busy} onClick={() => setPanel("more")}>
              More
            </ActionButton>
          ) : null}
        </div>
      ) : null}

      {panel === "more" ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-line pt-3">
          {/* The server only allows this once the start time has passed. */}
          <ActionButton disabled={busy} onClick={() => noShow.mutate({ appointmentId: appt.id })}>
            No-show
          </ActionButton>
          <ActionButton danger disabled={busy} onClick={() => setPanel("cancel")}>
            Cancel appointment
          </ActionButton>
          <ActionButton onClick={() => setPanel("none")}>Close</ActionButton>
        </div>
      ) : null}

      {panel === "cancel" ? (
        <div className="mt-4 border-t border-dashed border-line pt-3">
          <p className="mb-2 font-medium">
            Cancel {appt.client?.name ?? "this appointment"}? This frees the slot.
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              danger
              disabled={busy}
              onClick={() => cancel.mutate({ appointmentId: appt.id })}
            >
              {cancel.isPending ? "Cancelling…" : "Yes, cancel"}
            </ActionButton>
            <ActionButton onClick={() => setPanel("none")}>Keep it</ActionButton>
          </div>
        </div>
      ) : null}

      {panel === "pay" ? (
        <PayPanel
          appointmentId={appt.id}
          balanceDueCents={appt.balanceDueCents}
          onClose={() => setPanel("none")}
          onPaid={onDone}
        />
      ) : null}
    </article>
  );
}

const TIP_PRESETS = [0, 500, 1000];

function PayPanel(props: {
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

function ActionButton(props: {
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
