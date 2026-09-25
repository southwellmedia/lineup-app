"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlarmClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Plus,
  Wallet,
} from "lucide-react";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useShop } from "@/components/shop-context";
import { Badge, Card, CardTitle, Chip, cx, FOCUS, StatCard, type BadgeTone } from "@/components/ui";
import { formatTime } from "@/lib/booking/slots";
import { chairTime, formatClock } from "@/lib/dashboard/chair";
import { formatPhone, sourceLabel, STATUS_LABEL, summarizeDay } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";
import { ActionButton, BarberAvatar, PayPanel, useNow } from "./shared";

type Day = inferRouterOutputs<AppRouter>["schedule"]["day"];
type Appointment = Day["appointments"][number];

const LINK =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors [&_svg]:size-4";

export function DayBoard(props: { date: string; today: string }) {
  const trpc = useTRPC();
  const shop = useShop();
  const dayHref = (date: string) => `/dashboard/${shop.slug}?date=${date}` as Route;
  const { data: day } = useSuspenseQuery(
    trpc.schedule.day.queryOptions({ shopId: shop.id, date: props.date }),
  );
  const isManager = day.viewer.role === "owner" || day.viewer.role === "manager";
  const [barber, setBarber] = useState<string>("all");
  const now = useNow(30_000);

  const visible = day.appointments.filter((a) => barber === "all" || a.staffId === barber);
  const summary = summarizeDay(visible);
  const d = DateTime.fromISO(props.date);
  const isToday = props.date === props.today;
  const staffName = (id: string) => day.staff.find((s) => s.id === id)?.name ?? "—";
  const live = visible.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const done = live.filter((a) => a.status === "completed").length;
  const next = isToday
    ? live.find((a) => a.status === "confirmed" && Date.parse(a.startsAt) >= now)
    : undefined;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        {/* Date and actions */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">
              {day.shop.name} · {d.toFormat("ccc, LLL d")}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {isToday ? "Today" : d.toFormat("cccc")}
            </h1>
          </div>
          <nav aria-label="Change day" className="flex flex-wrap items-center gap-2">
            <DayLink
              href={dayHref(d.minus({ days: 1 }).toISODate() ?? props.date)}
              label="Previous day"
            >
              <ChevronLeft />
            </DayLink>
            {!isToday ? (
              <Link
                href={dayHref(props.today)}
                className={cx(LINK, "border-line bg-card hover:border-ink/40", FOCUS)}
              >
                Today
              </Link>
            ) : null}
            <DayLink href={dayHref(d.plus({ days: 1 }).toISODate() ?? props.date)} label="Next day">
              <ChevronRight />
            </DayLink>
            <Link
              href={`/dashboard/${shop.slug}/calendar?walkin=1` as Route}
              className={cx(LINK, "border-line bg-card hover:border-ink/40", FOCUS)}
            >
              Add walk-in
            </Link>
            <Link
              href={`/dashboard/${shop.slug}/calendar?date=${props.date}` as Route}
              className={cx(
                LINK,
                "border-brand bg-brand text-brand-ink hover:bg-[oklch(0.83_0.17_92)]",
                FOCUS,
              )}
            >
              <Plus aria-hidden />
              New booking
            </Link>
          </nav>
        </header>

        {/* Totals */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Booked"
            value={live.length}
            hint={live.length ? `${done} done · ${live.length - done} to go` : "Open book"}
          />
          <StatCard
            label="Expected"
            value={formatCents(summary.expectedCents)}
            hint="Services booked"
          />
          <StatCard
            label="Collected"
            value={formatCents(summary.collectedCents)}
            hint={summary.tipsCents ? `+${formatCents(summary.tipsCents)} tips` : "Cash and other"}
            tone="dark"
          />
          <StatCard
            label="Next up"
            value={next ? formatTime(next.startsAt, day.shop.timezone) : "—"}
            hint={
              next
                ? `${next.client?.name ?? "Client"} · ${staffName(next.staffId)}`
                : isToday
                  ? "Nothing else booked"
                  : "Pick today to see this"
            }
          />
        </div>

        {/* Who's in which chair right now */}
        {isToday ? <InTheChair appointments={day.appointments} staffName={staffName} /> : null}

        {/* Barber filter (owners and managers) */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[1.0625rem] font-semibold tracking-tight">Schedule</h2>
          {isManager && day.staff.length > 1 ? (
            <div role="group" aria-label="Barber" className="flex gap-1.5 overflow-x-auto">
              {[{ id: "all", name: "Everyone" }, ...day.staff].map((s) => (
                <Chip
                  key={s.id}
                  active={barber === s.id}
                  onClick={() => setBarber(s.id)}
                  className="h-8 px-3"
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card/60 p-8 text-center">
            <p className="text-lg font-semibold">Open book</p>
            <p className="mt-1 text-muted">No appointments this day yet.</p>
            <Link
              href={`/book/${day.shop.slug}` as Route}
              className="mt-4 inline-block text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
            >
              Open your booking page
            </Link>
          </div>
        ) : (
          <ol className="space-y-2.5">
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

      {/* Side rail */}
      <aside className="space-y-4">
        <NeedsYou appointments={live} isToday={isToday} now={now} timezone={day.shop.timezone} />
        <Sources appointments={live} />
        <BookingLinkCard slug={day.shop.slug} />
      </aside>
    </div>
  );
}

/** What someone should act on: late arrivals and finished cuts not paid for. */
function NeedsYou(props: {
  appointments: Appointment[];
  isToday: boolean;
  now: number;
  timezone: string;
}) {
  const late = props.isToday
    ? props.appointments.filter(
        (a) => a.status === "confirmed" && Date.parse(a.startsAt) + 10 * 60_000 < props.now,
      )
    : [];
  const unpaid = props.appointments.filter(
    (a) => a.status === "completed" && a.balanceDueCents > 0,
  );
  const items = [
    ...late.map((a) => ({
      id: a.id,
      icon: <AlarmClock aria-hidden />,
      title: `${a.client?.name ?? "Client"} hasn't checked in`,
      detail: `Booked for ${formatTime(a.startsAt, props.timezone)}. Check in or mark a no-show.`,
    })),
    ...unpaid.map((a) => ({
      id: a.id,
      icon: <Wallet aria-hidden />,
      title: `${a.client?.name ?? "Client"} owes ${formatCents(a.balanceDueCents)}`,
      detail: `Finished ${a.services.join(" + ")}. Record the payment.`,
    })),
  ];

  return (
    <Card>
      <CardTitle
        action={
          items.length ? (
            <Badge tone="brand">{items.length}</Badge>
          ) : (
            <span className="text-sm text-muted">All clear</span>
          )
        }
      >
        Needs you
      </CardTitle>
      {items.length ? (
        <ul className="-my-2 divide-y divide-line">
          {items.map((item) => (
            <li key={`${item.id}-${item.title}`}>
              <a
                href={`#appt-${item.id}`}
                className="-mx-2 flex gap-3 rounded-xl px-2 py-2.5 hover:bg-paper"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/25 [&_svg]:size-4">
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-sm text-muted">{item.detail}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="grid size-6 place-items-center rounded-full bg-success/12 text-success">
            <Check className="size-3.5" aria-hidden />
          </span>
          Nothing waiting on you.
        </p>
      )}
    </Card>
  );
}

/** Where this day's bookings came from. */
function Sources({ appointments }: { appointments: Appointment[] }) {
  if (!appointments.length) return null;
  const counts = new Map<string, number>();
  for (const a of appointments) counts.set(a.source, (counts.get(a.source) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardTitle>Booked by</CardTitle>
      <ul className="space-y-3">
        {rows.map(([source, n]) => {
          const pct = Math.round((n / appointments.length) * 100);
          return (
            <li key={source}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{sourceLabel(source)}</span>
                <span className="tabular-nums text-muted">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink/6">
                <div className="h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function BookingLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/book/${slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your booking link", `${window.location.origin}${path}`);
    }
  };
  return (
    <Card>
      <CardTitle>Your booking link</CardTitle>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper/50 p-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{path}</span>
        <button
          type="button"
          onClick={copy}
          className={cx(
            "inline-flex h-8 items-center gap-1.5 rounded-full bg-brand px-3 text-sm font-semibold text-brand-ink",
            FOCUS,
          )}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 flex items-center justify-between gap-2 text-sm text-muted">
        Every booking through it is commission-free.
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          aria-label="Open your booking page"
          className="shrink-0 text-ink hover:text-muted"
        >
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </p>
    </Card>
  );
}

/** Everyone checked in right now, with live timers. Tapping one jumps to its card. */
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
      <h2 className="mb-3 flex items-center gap-2 text-[1.0625rem] font-semibold tracking-tight">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        Right now
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((a) => {
          const t = chairTime(a, now);
          return (
            <li key={a.id}>
              <a
                href={`#appt-${a.id}`}
                className={cx(
                  "block rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink/30",
                  FOCUS,
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <BarberAvatar name={staffName(a.staffId)} />
                  <Badge tone={t.over ? "warning" : "success"}>
                    {t.over ? `+${Math.ceil(t.over / 60)} min` : "In chair"}
                  </Badge>
                </span>
                <span className="mt-3 block truncate font-semibold">
                  {a.client?.name ?? "Client"}
                </span>
                <span className="block truncate text-sm text-muted">
                  {staffName(a.staffId)} · {a.services.join(" + ")}
                </span>
                <span className="mt-3 flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/6">
                    <span
                      className={cx("block h-full rounded-full", t.over ? "bg-warning" : "bg-ink")}
                      style={{ width: `${Math.max(4, Math.min(1, t.progress) * 100)}%` }}
                    />
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
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
      title={label}
      className={cx(
        "grid size-10 place-items-center rounded-full border border-line bg-card hover:border-ink/40 [&_svg]:size-[1.125rem]",
        FOCUS,
      )}
    >
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */

const STATUS_TONE: Record<string, BadgeTone> = {
  confirmed: "neutral",
  checked_in: "brand",
  completed: "success",
  cancelled: "muted",
  no_show: "danger",
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
      className={cx(
        "scroll-mt-24 rounded-2xl border border-line bg-card p-4 transition-colors",
        inactive && "opacity-60",
      )}
    >
      <div className="flex gap-4">
        <div className="w-[5.5rem] shrink-0 whitespace-nowrap border-r border-line pr-3">
          <p className="font-semibold tabular-nums">{formatTime(appt.startsAt, props.timezone)}</p>
          <p className="text-xs text-muted tabular-nums">
            to {formatTime(appt.endsAt, props.timezone)}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{appt.client?.name ?? "Client"}</p>
              <p className="text-sm text-muted">
                {appt.services.join(" + ")}
                {props.barberName ? ` · ${props.barberName}` : ""}
              </p>
            </div>
            <Badge tone={STATUS_TONE[appt.status] ?? "neutral"}>{STATUS_LABEL[appt.status]}</Badge>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {appt.client?.phone ? (
              <a
                href={`tel:${appt.client.phone}`}
                className="underline-offset-4 hover:text-ink hover:underline"
              >
                {formatPhone(appt.client.phone)}
              </a>
            ) : null}
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
              <span className="text-muted">Note: </span>
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
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 sm:pl-[6.5rem]">
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
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 sm:pl-[6.5rem]">
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
        <div className="mt-3 border-t border-line pt-3 sm:pl-[6.5rem]">
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
 * progress bar, and who has them. "Finish & pay" is the main action.
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
  const ghost =
    "inline-flex h-8 items-center rounded-full border border-card/25 px-3.5 text-sm font-semibold hover:bg-card hover:text-ink disabled:opacity-40";

  return (
    <article
      id={`appt-${appt.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl bg-sidebar text-card"
    >
      <div
        className="h-1.5 bg-card/10"
        role="progressbar"
        aria-label="Time in the chair"
        aria-valuemin={0}
        aria-valuemax={Math.round(t.planned / 60)}
        aria-valuenow={Math.round(t.elapsed / 60)}
      >
        <div
          className="h-full bg-brand transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.max(3, Math.min(1, t.progress) * 100)}%` }}
        />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-card/70">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-brand" />
              </span>
              In the chair with {props.barberName}
            </p>
            <p className="mt-1 truncate text-lg font-semibold">{appt.client?.name ?? "Client"}</p>
            <p className="text-sm text-card/70">
              {appt.services.join(" + ")} ·{" "}
              <span className="tabular-nums">
                {formatCents(appt.balanceDueCents || appt.priceCents)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p
              role="timer"
              aria-label={`${Math.floor(t.elapsed / 60)} minutes in the chair`}
              className={cx(
                "text-4xl font-bold leading-none tracking-tight tabular-nums",
                t.over > 0 && "text-brand",
              )}
            >
              {formatClock(t.elapsed)}
            </p>
            <p className="mt-1 text-xs text-card/60">
              {t.over
                ? `+${Math.ceil(t.over / 60)} min over`
                : `of ${Math.round(t.planned / 60)} min · from ${formatTime(appt.checkedInAt ?? appt.startsAt, shop.timezone)}`}
            </p>
          </div>
        </div>

        {appt.note ? (
          <p className="mt-3 rounded-lg bg-card/10 px-3 py-2 text-sm">
            <span className="text-card/60">Note: </span>
            {appt.note}
          </p>
        ) : null}

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
              className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
            >
              Finish &amp; pay
            </button>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.setPanel("more")}
              className={cx(ghost, "h-9")}
            >
              More
            </button>
          </div>
        ) : null}

        {props.panel === "more" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={props.busy} onClick={props.onNoShow} className={ghost}>
              No-show
            </button>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.setPanel("cancel")}
              className={ghost}
            >
              Cancel appointment
            </button>
            <button
              type="button"
              onClick={() => props.setPanel("none")}
              className="h-8 rounded-full px-3 text-sm font-semibold text-card/70 hover:text-card"
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
                className="inline-flex h-8 items-center rounded-full bg-brand px-3.5 text-sm font-semibold text-brand-ink disabled:opacity-40"
              >
                Yes, cancel
              </button>
              <button type="button" onClick={() => props.setPanel("none")} className={ghost}>
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
