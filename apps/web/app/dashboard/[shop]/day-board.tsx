"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatTime } from "@/lib/booking/slots";
import { chairTime, formatClock } from "@/lib/dashboard/chair";
import { formatPhone, sourceLabel, STATUS_LABEL, summarizeDay } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useShop } from "@/components/shop-context";
import { useTRPC } from "@/trpc/client";
import { ActionButton, BarberAvatar, PayPanel, useNow } from "./shared";
import type { AppRouter } from "@/trpc/router";

type Day = inferRouterOutputs<AppRouter>["schedule"]["day"];
type Appointment = Day["appointments"][number];

export function DayBoard(props: { date: string; today: string }) {
  const trpc = useTRPC();
  const shop = useShop();
  const dayHref = (date: string) => `/dashboard/${shop.slug}?date=${date}` as Route;
  const { data: day } = useSuspenseQuery(
    trpc.schedule.day.queryOptions({ shopId: shop.id, date: props.date }),
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {day.shop.name}
          </p>
          <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight">
            {props.date === props.today ? "Today" : d.toFormat("cccc")}
            <span className="ml-3 font-serif text-2xl font-normal normal-case text-muted">
              {d.toFormat("LLLL d")}
            </span>
          </h1>
        </div>
        <nav aria-label="Change day" className="flex items-center gap-1.5">
          <DayLink
            href={dayHref(d.minus({ days: 1 }).toISODate() ?? props.date)}
            label="Previous day"
          >
            ←
          </DayLink>
          {props.date !== props.today ? (
            <Link
              href={dayHref(props.today)}
              className="rounded-full border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper"
            >
              Today
            </Link>
          ) : null}
          <DayLink href={dayHref(d.plus({ days: 1 }).toISODate() ?? props.date)} label="Next day">
            →
          </DayLink>
          <Link
            href={`/dashboard/${shop.slug}/calendar?walkin=1` as Route}
            className="ml-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-brand hover:text-brand-ink"
          >
            + Walk-in
          </Link>
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

      {/* Who's in which chair right now */}
      {props.date === props.today ? (
        <InTheChair appointments={day.appointments} staffName={staffName} />
      ) : null}

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
                barberName={
                  appt.status === "checked_in" || (isManager && day.staff.length > 1)
                    ? staffName(appt.staffId)
                    : null
                }
                queryKey={trpc.schedule.day.pathKey()}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The current time, ticking every `ms` milliseconds. */
/** A strip of everyone checked in right now, with live timers. Tapping one jumps to its card. */
function InTheChair({
  appointments,
  staffName,
}: {
  appointments: Appointment[];
  staffName: (id: string) => string;
}) {
  const now = useNow();
  const active = appointments.filter((a) => a.status === "checked_in");
  if (active.length === 0) return null;

  return (
    <section aria-label="In the chair now" className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-brand" />
        </span>
        In the chair now
      </h2>
      <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {active.map((a) => {
          const t = chairTime(a, now);
          return (
            <li key={a.id} className="shrink-0">
              <a
                href={`#appt-${a.id}`}
                className="flex items-center gap-3 rounded-2xl bg-ink py-2.5 pl-2.5 pr-4 text-paper transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <BarberAvatar name={staffName(a.staffId)} />
                <span className="min-w-0">
                  <span className="block text-xs text-paper/60">
                    {staffName(a.staffId)} · {a.client?.name ?? "Client"}
                  </span>
                  <span
                    className={`font-display text-2xl font-extrabold leading-none tabular-nums ${t.over ? "text-brand" : ""}`}
                  >
                    {formatClock(t.elapsed)}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
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

  if (appt.status === "checked_in") {
    return (
      <ChairCard
        appt={appt}
        barberName={props.barberName ?? "Barber"}
        panel={panel}
        setPanel={setPanel}
        error={error}
        busy={noShow.isPending || cancel.isPending}
        onNoShow={() => noShow.mutate({ appointmentId: appt.id })}
        onCancel={() => cancel.mutate({ appointmentId: appt.id })}
        onPaid={onDone}
      />
    );
  }

  const inactive = appt.status === "cancelled" || appt.status === "no_show";
  const live = appt.status === "confirmed";
  const canPay = (live || appt.status === "completed") && appt.balanceDueCents > 0;
  const busy = checkIn.isPending || noShow.isPending || cancel.isPending;

  return (
    <article
      id={`appt-${appt.id}`}
      className={`scroll-mt-24 rounded-2xl border border-line bg-card p-4 transition-colors ${inactive ? "opacity-60" : ""}`}
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
              {appt.client?.phone ? (
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

/**
 * A client who is checked in: a live timer against the booked length, a
 * barber-pole progress bar, and who has them. "Finish & pay" is the main action.
 */
function ChairCard(props: {
  appt: Appointment;
  barberName: string;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  error: string | null;
  busy: boolean;
  onNoShow: () => void;
  onCancel: () => void;
  onPaid: () => Promise<void>;
}) {
  const { appt } = props;
  const now = useNow();
  const t = chairTime(appt, now);
  const shop = useShop();

  return (
    <article
      id={`appt-${appt.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl bg-ink text-paper shadow-[5px_5px_0_0_var(--color-brand)]"
    >
      {/* Progress against the booked time; the stripe keeps moving while they're in the chair. */}
      <div
        className="h-2 bg-paper/10"
        role="progressbar"
        aria-label="Time in the chair"
        aria-valuemin={0}
        aria-valuemax={Math.round(t.planned / 60)}
        aria-valuenow={Math.round(t.elapsed / 60)}
      >
        <div
          className="pole h-full animate-pole transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.max(3, t.progress * 100)}%` }}
        />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-paper/70">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            In the chair
          </p>
          <p className="flex items-center gap-2 text-sm">
            <BarberAvatar name={props.barberName} />
            <span>
              <span className="block text-xs text-paper/60">with</span>
              <span className="font-semibold">{props.barberName}</span>
            </span>
          </p>
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <p
            role="timer"
            aria-label={`${Math.floor(t.elapsed / 60)} minutes in the chair`}
            className={`font-display text-7xl font-black leading-none tracking-tight tabular-nums ${t.over ? "text-brand" : ""}`}
          >
            {formatClock(t.elapsed)}
          </p>
          <p className="pb-2 text-sm text-paper/70">
            {t.over
              ? `+${Math.ceil(t.over / 60)} min over`
              : `of ${Math.round(t.planned / 60)} min · started ${formatTime(appt.checkedInAt ?? appt.startsAt, shop.timezone)}`}
          </p>
        </div>

        <div className="mt-4 border-t border-paper/15 pt-3">
          <p className="text-xl font-semibold">{appt.client?.name ?? "Client"}</p>
          <p className="text-paper/80">
            {appt.services.join(" + ")} ·{" "}
            <span className="tabular-nums">
              {formatCents(appt.balanceDueCents || appt.priceCents)}
            </span>
          </p>
          {appt.note ? (
            <p className="mt-2 rounded-lg bg-paper/10 px-3 py-2 text-sm">
              <span className="font-serif text-paper/60">Note: </span>
              {appt.note}
            </p>
          ) : null}
        </div>

        {props.error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-ink"
          >
            {props.error}
          </p>
        ) : null}

        {props.panel === "none" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => props.setPanel("pay")}
              className="rounded-full bg-brand px-5 py-2.5 font-semibold text-brand-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
            >
              Finish &amp; pay
            </button>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.setPanel("more")}
              className="rounded-full border border-paper/30 px-4 py-2.5 text-sm font-semibold hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper disabled:opacity-40"
            >
              More
            </button>
          </div>
        ) : null}

        {props.panel === "more" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={props.busy}
              onClick={props.onNoShow}
              className="rounded-full border border-paper/30 px-4 py-2 text-sm font-semibold hover:bg-paper hover:text-ink disabled:opacity-40"
            >
              No-show
            </button>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.setPanel("cancel")}
              className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-brand-ink disabled:opacity-40"
            >
              Cancel appointment
            </button>
            <button
              type="button"
              onClick={() => props.setPanel("none")}
              className="rounded-full px-4 py-2 text-sm font-semibold text-paper/70 hover:text-paper"
            >
              Close
            </button>
          </div>
        ) : null}

        {props.panel === "cancel" ? (
          <div className="mt-4">
            <p className="mb-2 font-medium">
              Cancel {appt.client?.name ?? "this appointment"}? This frees the slot.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={props.busy}
                onClick={props.onCancel}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-40"
              >
                Yes, cancel
              </button>
              <button
                type="button"
                onClick={() => props.setPanel("none")}
                className="rounded-full border border-paper/30 px-4 py-2 text-sm font-semibold hover:bg-paper hover:text-ink"
              >
                Keep it
              </button>
            </div>
          </div>
        ) : null}

        {props.panel === "pay" ? (
          <div className="mt-4 rounded-xl bg-card p-4 text-ink [&>form]:mt-0 [&>form]:border-t-0 [&>form]:pt-0">
            <PayPanel
              appointmentId={appt.id}
              balanceDueCents={appt.balanceDueCents}
              onClose={() => props.setPanel("none")}
              onPaid={props.onPaid}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
