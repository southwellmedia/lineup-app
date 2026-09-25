"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { AnimatePresence, motion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Sheet } from "@/components/sheet";
import { useShop } from "@/components/shop-context";
import { Field, Input, Notice, Select } from "@/components/ui";
import { instantAt } from "@/lib/calendar/grid";
import { chairTime, formatClock } from "@/lib/dashboard/chair";
import { formatPhone, sourceLabel } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import { VisitPhotos } from "../photos";
import { ActionButton, BarberAvatar, PayPanel, useNow } from "../shared";
import type { BookingDraft } from "./booking-panel";
import type { CalendarAppointment, CalendarData } from "./calendar-view";

const STATUS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "Booked", tone: "bg-paper text-ink ring-1 ring-line" },
  checked_in: { label: "In the chair", tone: "bg-brand text-brand-ink" },
  completed: { label: "Done", tone: "bg-ink text-paper" },
  no_show: { label: "No-show", tone: "bg-danger/10 text-danger" },
};

const BOOKED_BY: Record<string, string> = {
  client: "the client online",
  staff: "the shop",
  chat_agent: "the chat assistant",
  voice_agent: "the voice assistant",
  import: "an import",
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 34 } },
} as const;

const TEXT_KIND: Record<string, string> = {
  confirmation: "Confirmation",
  reminder_24h: "Day-before reminder",
  reminder_2h: "2-hour reminder",
  reply: "Auto-reply",
  inbound: "Client",
};
const TEXT_STATUS: Record<string, string> = {
  queued: "sending",
  failed: "failed",
  skipped: "not sent (texts not set up)",
};

export function AppointmentPanel(props: {
  appointment: CalendarAppointment;
  calendar: CalendarData;
  onClose: () => void;
  onRebook: (draft: Partial<BookingDraft>) => void;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const { calendar } = props;
  const tz = calendar.timezone;
  const now = useNow(1000);

  const { data: detail } = useQuery(
    trpc.calendar.appointment.queryOptions({
      shopId: shop.id,
      appointmentId: props.appointment.id,
    }),
  );
  // Until the detail loads, the calendar's copy fills the panel.
  const a = detail
    ? {
        ...props.appointment,
        staffId: detail.staffId,
        status: detail.status,
        startsAt: detail.startsAt,
        endsAt: detail.endsAt,
        checkedInAt: detail.checkedInAt,
        priceCents: detail.priceCents,
        note: detail.note,
      }
    : props.appointment;
  const start = DateTime.fromISO(a.startsAt, { zone: tz });
  const end = DateTime.fromISO(a.endsAt, { zone: tz });
  const barber = calendar.barbers.find((b) => b.id === a.staffId);
  const status = STATUS[a.status] ?? STATUS.confirmed!;
  const started = Date.parse(a.startsAt) <= now;

  const [mode, setMode] = useState<"view" | "move" | "pay" | "cancel">("view");
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.calendar.range.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.calendar.appointment.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.schedule.day.pathKey() }),
    ]);
  const onError = (e: { message: string; data?: { code?: string } | null }) =>
    setError(
      e.data?.code === "CONFLICT"
        ? "That time is already taken. Try another time or barber."
        : e.message,
    );
  const done = async () => {
    setError(null);
    setMode("view");
    await refresh();
  };

  const checkIn = useMutation(
    trpc.appointments.checkIn.mutationOptions({ onSuccess: done, onError }),
  );
  const noShow = useMutation(
    trpc.appointments.markNoShow.mutationOptions({ onSuccess: done, onError }),
  );
  const cancel = useMutation(
    trpc.appointments.cancel.mutationOptions({
      onSuccess: async () => {
        await refresh();
        props.onClose();
      },
      onError,
    }),
  );

  const client = detail?.client;
  const rebook = () =>
    props.onRebook({
      staffId: a.staffId,
      date: start.plus({ weeks: 3 }).toISODate() ?? undefined,
      minutes: start.hour * 60 + start.minute,
      client: client ? { id: client.id, name: client.name, phone: client.phone } : undefined,
      serviceIds: detail?.services.flatMap((s) => (s.serviceId ? [s.serviceId] : [])),
    });

  return (
    <Sheet title={a.client?.name ?? "Appointment"} onClose={props.onClose}>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.045 } } }}
        className="space-y-4"
      >
        {/* Status, source and the live chair timer */}
        <motion.div variants={item} className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${status.tone}`}>
            {status.label}
          </span>
          <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-muted ring-1 ring-line">
            {sourceLabel(a.source)}
          </span>
          {a.status === "checked_in" && a.checkedInAt ? (
            <ChairTimer
              startsAt={a.startsAt}
              endsAt={a.endsAt}
              checkedInAt={a.checkedInAt}
              now={now}
            />
          ) : null}
        </motion.div>

        {/* When and who */}
        <motion.section variants={item} className="overflow-hidden rounded-2xl bg-ink text-paper">
          <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-4">
            <div>
              <p className="text-sm text-paper/60">{start.toFormat("cccc, LLLL d")}</p>
              <p className="font-display text-4xl font-black leading-none tabular-nums">
                {start.toFormat("h:mm")}
                <span className="ml-1 text-xl">{start.toFormat("a")}</span>
              </p>
            </div>
            <p className="text-right text-sm text-paper/70">
              until {end.toFormat("h:mm a")}
              <span className="block font-semibold text-paper">
                {Math.round(end.diff(start, "minutes").minutes)} min
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2.5 border-t border-paper/10 bg-paper/5 px-4 py-2.5">
            <BarberAvatar name={barber?.name ?? "?"} />
            <span className="text-sm">
              with <span className="font-semibold">{barber?.name ?? "—"}</span>
            </span>
          </div>
        </motion.section>

        {/* Client */}
        {a.client ? (
          <motion.section variants={item} className="rounded-2xl p-4 ring-1 ring-line">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paper font-display text-2xl font-black uppercase ring-1 ring-line"
              >
                {a.client.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{a.client.name}</p>
                <p className="text-sm text-muted">
                  {client
                    ? client.visits > 1
                      ? `${client.visits} visits · ${formatCents(client.spentCents)} spent`
                      : "First visit"
                    : "Loading history…"}
                  {client?.lastVisitAt && client.visits > 1
                    ? ` · last ${DateTime.fromISO(client.lastVisitAt).toRelative()}`
                    : ""}
                </p>
              </div>
            </div>
            {client?.noShows ? (
              <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                {client.noShows} earlier no-show{client.noShows === 1 ? "" : "s"}
              </p>
            ) : null}
            {client?.notes ? (
              <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="font-semibold">Notes: </span>
                {client.notes}
              </p>
            ) : null}
            {a.note ? (
              <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="font-semibold">For this visit: </span>
                {a.note}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {a.client.phone ? (
                <>
                  <PillLink href={`tel:${a.client.phone}`}>
                    Call {formatPhone(a.client.phone)}
                  </PillLink>
                  <PillLink href={`sms:${a.client.phone}`}>Text</PillLink>
                </>
              ) : (
                <span className="text-sm text-muted">No phone number</span>
              )}
              {client ? (
                <Link
                  href={`/dashboard/${shop.slug}/clients/${client.id}` as Route}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  Profile
                </Link>
              ) : null}
            </div>
          </motion.section>
        ) : null}

        {/* Photos: snap the finished cut; see what they had last time. */}
        {client ? (
          <motion.section variants={item} className="rounded-2xl p-4 ring-1 ring-line">
            <p className="mb-3 text-sm font-semibold">Photos</p>
            <VisitPhotos clientId={client.id} appointmentId={a.id} />
          </motion.section>
        ) : null}

        {/* Texts: what the client was sent and what they replied. */}
        {detail && (detail.texts.length || detail.clientConfirmedAt) ? (
          <motion.section variants={item} className="rounded-2xl p-4 ring-1 ring-line">
            <p className="mb-3 flex items-center justify-between text-sm font-semibold">
              Texts
              {detail.clientConfirmedAt ? (
                <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-paper">
                  Client confirmed
                </span>
              ) : null}
            </p>
            <ul className="space-y-2">
              {detail.texts.map((t) => (
                <li
                  key={t.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    t.direction === "inbound"
                      ? "bg-paper ring-1 ring-line"
                      : "ml-auto bg-ink/[0.06]"
                  }`}
                >
                  <p className="whitespace-pre-line">{t.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {TEXT_KIND[t.kind] ?? t.kind} ·{" "}
                    {DateTime.fromISO(t.at, { zone: tz }).toFormat("MMM d, h:mm a")}
                    {t.status === "sent" || t.status === "received"
                      ? ""
                      : ` · ${TEXT_STATUS[t.status] ?? t.status}`}
                  </p>
                </li>
              ))}
            </ul>
          </motion.section>
        ) : null}

        {/* Services and money */}
        <motion.section variants={item} className="rounded-2xl p-4 ring-1 ring-line">
          <ul className="space-y-1.5">
            {(
              detail?.services ??
              a.services.map((name) => ({
                name,
                priceCents: null,
                durationMinutes: null,
                isAddon: false,
              }))
            ).map((s, i) => (
              <li key={`${s.name}-${i}`} className="flex items-baseline justify-between gap-3">
                <span>
                  <span className="font-semibold">{s.name}</span>
                  {s.durationMinutes ? (
                    <span className="ml-1.5 text-sm text-muted">{s.durationMinutes} min</span>
                  ) : null}
                </span>
                {s.priceCents !== null ? (
                  <span className="tabular-nums">{formatCents(s.priceCents)}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-line pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-display text-2xl font-black tabular-nums">
              {formatCents(a.priceCents)}
            </span>
          </div>
          {detail ? (
            <p
              className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                detail.balanceDueCents <= 0 && detail.paidCents > 0
                  ? "bg-ink text-paper"
                  : "bg-paper text-ink ring-1 ring-line"
              }`}
            >
              {detail.balanceDueCents <= 0 && detail.paidCents > 0
                ? `Paid ${formatCents(detail.paidCents)}${detail.tipCents ? ` + ${formatCents(detail.tipCents)} tip` : ""}`
                : detail.paidCents > 0
                  ? `${formatCents(detail.paidCents)} paid · ${formatCents(detail.balanceDueCents)} due`
                  : `${formatCents(detail.balanceDueCents)} due${detail.depositCents ? ` (deposit ${formatCents(detail.depositCents)})` : ""}`}
            </p>
          ) : null}
        </motion.section>

        {detail ? (
          <motion.p variants={item} className="text-xs text-muted">
            Booked by {BOOKED_BY[detail.bookedBy] ?? detail.bookedBy}{" "}
            {DateTime.fromISO(detail.createdAt).toRelative()}
          </motion.p>
        ) : null}

        {error ? <Notice tone="error">{error}</Notice> : null}

        {/* Actions change with the booking's status. */}
        <AnimatePresence mode="wait" initial={false}>
          {mode === "move" ? (
            <MoveForm
              key="move"
              appointment={a}
              calendar={calendar}
              onBack={() => setMode("view")}
              onMoved={async () => {
                await refresh();
                props.onClose();
              }}
              onError={onError}
            />
          ) : mode === "pay" && detail ? (
            <motion.div
              key="pay"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <PayPanel
                appointmentId={a.id}
                balanceDueCents={detail.balanceDueCents}
                onClose={() => setMode("view")}
                onPaid={done}
              />
            </motion.div>
          ) : mode === "cancel" ? (
            <motion.div
              key="cancel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3 rounded-2xl bg-danger/5 p-4 ring-1 ring-danger/30"
            >
              <p className="font-semibold">Cancel this booking? The slot opens up for others.</p>
              <div className="flex gap-2">
                <ActionButton
                  danger
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate({ appointmentId: a.id })}
                >
                  {cancel.isPending ? "Cancelling…" : "Yes, cancel it"}
                </ActionButton>
                <ActionButton onClick={() => setMode("view")}>Keep it</ActionButton>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2 border-t border-line pt-4"
            >
              {a.status === "confirmed" ? (
                <>
                  <ActionButton
                    primary
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate({ appointmentId: a.id })}
                  >
                    {checkIn.isPending ? "Checking in…" : "Check in"}
                  </ActionButton>
                  <ActionButton onClick={() => setMode("move")}>Move</ActionButton>
                  {started ? (
                    <ActionButton
                      disabled={noShow.isPending}
                      onClick={() => noShow.mutate({ appointmentId: a.id })}
                    >
                      No-show
                    </ActionButton>
                  ) : null}
                  <ActionButton danger onClick={() => setMode("cancel")}>
                    Cancel
                  </ActionButton>
                </>
              ) : null}
              {a.status === "checked_in" ? (
                <>
                  <ActionButton primary disabled={!detail} onClick={() => setMode("pay")}>
                    Take payment
                  </ActionButton>
                  <ActionButton danger onClick={() => setMode("cancel")}>
                    Cancel
                  </ActionButton>
                </>
              ) : null}
              {a.status === "completed" && detail && detail.balanceDueCents > 0 ? (
                <ActionButton primary onClick={() => setMode("pay")}>
                  Take payment
                </ActionButton>
              ) : null}
              {a.client ? (
                <ActionButton
                  primary={a.status === "completed" || a.status === "no_show"}
                  onClick={rebook}
                >
                  Book again
                </ActionButton>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        {a.status === "confirmed" && mode === "view" ? (
          <p className="hidden text-xs text-muted md:block">
            Tip: you can also drag bookings on the calendar to move them.
          </p>
        ) : null}
      </motion.div>
    </Sheet>
  );
}

function ChairTimer(props: { startsAt: string; endsAt: string; checkedInAt: string; now: number }) {
  const t = chairTime(
    { startsAt: props.startsAt, endsAt: props.endsAt, checkedInAt: props.checkedInAt },
    props.now,
  );
  return (
    <span
      className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1 font-display text-lg font-black tabular-nums ${t.over ? "bg-brand text-brand-ink" : "bg-ink text-paper"}`}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-current" />
      </span>
      {formatClock(t.elapsed)}
    </span>
  );
}

function PillLink(props: { href: string; children: ReactNode }) {
  return (
    <a
      href={props.href}
      className="rounded-full bg-paper px-3 py-1.5 text-sm font-semibold ring-1 ring-line transition-colors hover:bg-ink hover:text-paper"
    >
      {props.children}
    </a>
  );
}

function MoveForm(props: {
  appointment: CalendarAppointment;
  calendar: CalendarData;
  onBack: () => void;
  onMoved: () => Promise<void>;
  onError: (e: { message: string; data?: { code?: string } | null }) => void;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const tz = props.calendar.timezone;
  const start = DateTime.fromISO(props.appointment.startsAt, { zone: tz });
  const [date, setDate] = useState(start.toISODate() ?? "");
  const [time, setTime] = useState(start.toFormat("HH:mm"));
  const [staffId, setStaffId] = useState(props.appointment.staffId);
  const reschedule = useMutation(
    trpc.calendar.reschedule.mutationOptions({ onSuccess: props.onMoved, onError: props.onError }),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const [h, m] = time.split(":").map(Number);
    reschedule.mutate({
      shopId: shop.id,
      appointmentId: props.appointment.id,
      staffId,
      startsAt: instantAt(date, (h ?? 0) * 60 + (m ?? 0), tz).toISOString(),
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onSubmit={submit}
      className="space-y-3 rounded-2xl p-4 ring-1 ring-line"
    >
      <p className="font-semibold">Move to</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="m-date">
          <Input
            id="m-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </Field>
        <Field label="Time" htmlFor="m-time">
          <Input
            id="m-time"
            type="time"
            step={300}
            value={time}
            onChange={(e) => e.target.value && setTime(e.target.value)}
          />
        </Field>
        {props.calendar.viewer.isManager && props.calendar.barbers.length > 1 ? (
          <Field label="Barber" htmlFor="m-barber" className="col-span-2">
            <Select id="m-barber" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {props.calendar.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <ActionButton onClick={props.onBack}>Back</ActionButton>
        <ActionButton primary type="submit" disabled={reschedule.isPending}>
          {reschedule.isPending ? "Moving…" : "Move booking"}
        </ActionButton>
      </div>
    </motion.form>
  );
}
