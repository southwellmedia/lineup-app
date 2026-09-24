"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { DateTime } from "luxon";
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useShop } from "@/components/shop-context";
import { Button, PageHeader } from "@/components/ui";
import {
  addDays,
  dateRange,
  formatClockMinutes,
  instantAt,
  lanes,
  snap,
  todayIn,
  visibleHours,
  wallMinutes,
  weekStart,
} from "@/lib/calendar/grid";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";
import { BarberAvatar, useNow } from "../shared";
import { AppointmentPanel } from "./appointment-panel";
import { BookingPanel, type BookingDraft } from "./booking-panel";

export type CalendarData = inferRouterOutputs<AppRouter>["calendar"]["range"];
export type Menu = inferRouterOutputs<AppRouter>["services"]["list"];
export type CalendarAppointment = CalendarData["appointments"][number];

type View = "day" | "week";
type Column = { key: string; date: string; barberId: string; title: string; subtitle?: string };
type Move = { staffId: string; startsAt: string; endsAt: string };

/** Pixels per minute: 96px an hour, roomy enough for a 15-minute lineup. */
const PX = 1.6;
/** Drag and hover snap to 5 minutes; clicks on empty time snap to the shop's slot grid. */
const DRAG_STEP = 5;
const SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;

export function CalendarView(props: {
  initialDate: string;
  initialView: View;
  today: string;
  openWalkIn: boolean;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(props.initialDate);
  const [view, setView] = useState<View>(props.initialView);
  const [weekBarber, setWeekBarber] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const start = view === "week" ? weekStart(date) : date;
  const days = view === "week" ? 7 : 1;
  const { data } = useSuspenseQuery(
    trpc.calendar.range.queryOptions(
      { shopId: shop.id, start, days },
      { refetchInterval: 60_000, placeholderData: (previous) => previous },
    ),
  );
  const { data: menu } = useSuspenseQuery(trpc.services.list.queryOptions({ shopId: shop.id }));

  // Keep the URL shareable without re-running the server page.
  useEffect(() => {
    const url = `/dashboard/${shop.slug}/calendar?date=${date}${view === "week" ? "&view=week" : ""}`;
    window.history.replaceState(null, "", url);
  }, [date, view, shop.slug]);

  const tz = data.timezone;
  const barberId = weekBarber ?? data.barbers[0]?.id ?? null;
  const today = todayIn(tz);
  const now = useNow(30_000);

  // "?walkin=1" (the Today board's Walk-in button) opens the walk-in form.
  const [draft, setDraft] = useState<BookingDraft | null>(() =>
    props.openWalkIn
      ? {
          staffId: data.viewer.isManager ? freeBarberNow(data) : data.viewer.staffId,
          date: today,
          minutes: snap(wallMinutes(new Date(), today, tz), 5),
          walkIn: true,
        }
      : null,
  );

  /* ---- Optimistic moves: shown immediately, dropped once the server answers. ---- */
  const [moves, setMoves] = useState<Record<string, Move>>({});
  const [toast, setToast] = useState<{ id: number; text: string; undo?: () => void } | null>(null);
  const appointments = useMemo(
    () => data.appointments.map((a) => (moves[a.id] ? { ...a, ...moves[a.id] } : a)),
    [data.appointments, moves],
  );

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.calendar.range.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.schedule.day.pathKey() }),
      ]),
    [queryClient, trpc],
  );
  const reschedule = useMutation(trpc.calendar.reschedule.mutationOptions());

  const barberName = useCallback(
    (id: string) => data.barbers.find((b) => b.id === id)?.name ?? "",
    [data.barbers],
  );

  function move(a: CalendarAppointment, to: Move, undoable: boolean) {
    setMoves((m) => ({ ...m, [a.id]: to }));
    const from: Move = { staffId: a.staffId, startsAt: a.startsAt, endsAt: a.endsAt };
    const at = DateTime.fromISO(to.startsAt, { zone: tz });
    reschedule.mutate(
      { shopId: shop.id, appointmentId: a.id, staffId: to.staffId, startsAt: to.startsAt },
      {
        onSuccess: async () => {
          await refresh();
          setMoves((m) => without(m, a.id));
          setToast({
            id: Date.now(),
            text: `${a.client?.name ?? "Booking"} moved to ${at.toFormat("ccc h:mm a")}${to.staffId !== a.staffId ? ` with ${barberName(to.staffId)}` : ""}`,
            undo: undoable ? () => move({ ...a, ...to }, from, false) : undefined,
          });
        },
        onError: (e) => {
          setMoves((m) => without(m, a.id));
          setToast({
            id: Date.now(),
            text:
              e.data?.code === "CONFLICT"
                ? "That time is already taken, so the booking stayed put."
                : e.message,
          });
        },
      },
    );
  }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---- Columns and visible hours ---- */
  const columns: Column[] = useMemo(() => {
    if (view === "day") {
      return data.barbers.map((b) => ({ key: b.id, date, barberId: b.id, title: b.name }));
    }
    return dateRange(start, 7).map((d) => {
      const day = DateTime.fromISO(d);
      return {
        key: d,
        date: d,
        barberId: barberId ?? "",
        title: day.toFormat("ccc"),
        subtitle: day.toFormat("d"),
      };
    });
  }, [view, data.barbers, date, start, barberId]);

  const hours = useMemo(() => {
    const ranges: { start: number; end: number }[] = [];
    for (const col of columns) {
      const barber = data.barbers.find((b) => b.id === col.barberId);
      for (const w of barber?.working ?? []) {
        const s = wallMinutes(w.start, col.date, tz);
        const e = wallMinutes(w.end, col.date, tz);
        if (e > 0 && s < 24 * 60) ranges.push({ start: s, end: e });
      }
    }
    for (const a of appointments) {
      const d = DateTime.fromISO(a.startsAt, { zone: tz }).toISODate();
      if (!d || !columns.some((c) => c.date === d)) continue;
      ranges.push({ start: wallMinutes(a.startsAt, d, tz), end: wallMinutes(a.endsAt, d, tz) });
    }
    return visibleHours(ranges);
  }, [columns, data.barbers, appointments, tz]);

  // Start scrolled to just before now (today) or to the first working hour.
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const el = scroller.current;
    const key = `${view}:${start}`;
    if (!el || scrolledFor.current === key) return;
    scrolledFor.current = key;
    const focus = columns.some((c) => c.date === today)
      ? wallMinutes(new Date(), today, tz) - 60
      : hours.start;
    el.scrollTo({ top: Math.max(0, (focus - hours.start) * PX), behavior: "smooth" });
  }, [columns, hours.start, start, today, tz, view]);

  /* ---- Drag and drop ---- */
  const dragRef = useRef<{
    appointment: CalendarAppointment;
    x: number;
    y: number;
    offset: number;
    duration: number;
    started: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{
    id: string;
    key: string;
    start: number;
    duration: number;
  } | null>(null);

  const canDrag = useCallback(
    (a: CalendarAppointment) =>
      a.status === "confirmed" && (data.viewer.isManager || a.staffId === data.viewer.staffId),
    [data.viewer],
  );

  const onBlockPointerDown = (a: CalendarAppointment, e: ReactPointerEvent<HTMLElement>) => {
    // Touch keeps scrolling the calendar; phones move bookings from the panel.
    if (e.button !== 0 || e.pointerType === "touch" || !canDrag(a)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startMin = wallMinutes(
      a.startsAt,
      DateTime.fromISO(a.startsAt, { zone: tz }).toISODate() ?? date,
      tz,
    );
    const endMin = startMin + (Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60_000;
    dragRef.current = {
      appointment: a,
      x: e.clientX,
      y: e.clientY,
      offset: (e.clientY - rect.top) / PX,
      duration: endMin - startMin,
      started: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBlockPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.started && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    d.started = true;

    // Which column is under the pointer (nearest one if it's off the grid).
    let target: { key: string; rect: DOMRect } | null = null;
    let best = Infinity;
    for (const el of scroller.current?.querySelectorAll<HTMLElement>("[data-col]") ?? []) {
      const rect = el.getBoundingClientRect();
      const distance =
        e.clientX < rect.left
          ? rect.left - e.clientX
          : e.clientX > rect.right
            ? e.clientX - rect.right
            : 0;
      if (distance < best) {
        best = distance;
        target = { key: el.dataset.col ?? "", rect };
      }
    }
    if (!target) return;
    const raw = hours.start + (e.clientY - target.rect.top) / PX - d.offset;
    const startMin = Math.min(
      Math.max(Math.round(raw / DRAG_STEP) * DRAG_STEP, hours.start),
      hours.end - d.duration,
    );
    setGhost((g) =>
      g && g.key === target.key && g.start === startMin
        ? g
        : { id: d.appointment.id, key: target.key, start: startMin, duration: d.duration },
    );

    // Scroll when dragging near the top or bottom edge.
    const box = scroller.current?.getBoundingClientRect();
    if (box && scroller.current) {
      if (e.clientY < box.top + 48) scroller.current.scrollBy({ top: -12 });
      else if (e.clientY > box.bottom - 48) scroller.current.scrollBy({ top: 12 });
    }
  };

  const endDrag = (commit: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    const g = ghost;
    setGhost(null);
    if (!d?.started) return;
    // Swallow the click that ends a drag, but only that one: if the block
    // moved to another column no click fires, so reset on the next frame.
    suppressClick.current = true;
    requestAnimationFrame(() => {
      suppressClick.current = false;
    });
    if (!commit || !g) return;
    const col = columns.find((c) => c.key === g.key);
    if (!col) return;
    const startsAt = instantAt(col.date, g.start, tz);
    if (
      col.barberId === d.appointment.staffId &&
      startsAt.getTime() === Date.parse(d.appointment.startsAt)
    ) {
      return;
    }
    move(
      d.appointment,
      {
        staffId: col.barberId,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + d.duration * 60_000).toISOString(),
      },
      true,
    );
  };

  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dragRef.current?.started) {
        dragRef.current = null;
        suppressClick.current = true;
        requestAnimationFrame(() => {
          suppressClick.current = false;
        });
        setGhost(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);

  /* ---- New bookings ---- */
  const newBooking = useCallback(
    (partial: Partial<BookingDraft> = {}) => {
      const staffId =
        partial.staffId ??
        (!data.viewer.isManager
          ? data.viewer.staffId
          : partial.walkIn
            ? freeBarberNow(data)
            : (barberId ?? data.barbers[0]?.id ?? ""));
      const nowMinutes = snap(wallMinutes(new Date(), today, tz), 5);
      setDraft({
        staffId,
        date: partial.date ?? (date < today ? today : date),
        minutes: partial.minutes ?? Math.max(nowMinutes, hours.start),
        walkIn: partial.walkIn ?? false,
        client: partial.client,
        serviceIds: partial.serviceIds,
      });
    },
    [barberId, data, date, hours.start, today, tz],
  );

  const heading =
    view === "day"
      ? DateTime.fromISO(date).toFormat("cccc, LLL d")
      : `${DateTime.fromISO(start).toFormat("LLL d")} – ${DateTime.fromISO(addDays(start, 6)).toFormat("LLL d")}`;

  const selectedAppointment = appointments.find((a) => a.id === selected) ?? null;
  const gridHeight = (hours.end - hours.start) * PX;

  return (
    <MotionConfig reducedMotion="user">
      <PageHeader
        kicker="Calendar"
        title={heading}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                newBooking({
                  walkIn: true,
                  date: today,
                  minutes: snap(wallMinutes(new Date(), today, tz), 5),
                })
              }
            >
              + Walk-in
            </Button>
            <Button variant="primary" onClick={() => newBooking()}>
              New booking
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-line bg-card p-1 shadow-sm">
          <IconButton
            label={view === "day" ? "Previous day" : "Previous week"}
            onClick={() => setDate(addDays(date, view === "day" ? -1 : -7))}
          >
            ‹
          </IconButton>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="rounded-full px-3 py-1 text-sm font-semibold transition-colors hover:bg-paper disabled:text-muted"
            disabled={view === "day" ? date === today : weekStart(today) === start}
          >
            Today
          </button>
          <IconButton
            label={view === "day" ? "Next day" : "Next week"}
            onClick={() => setDate(addDays(date, view === "day" ? 1 : 7))}
          >
            ›
          </IconButton>
        </div>

        <input
          type="date"
          aria-label="Go to date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-sm shadow-sm"
        />

        <Segmented
          label="View"
          value={view}
          options={[
            ["day", "Day"],
            ["week", "Week"],
          ]}
          onChange={setView}
        />

        {view === "week" && data.barbers.length > 1 ? (
          <Segmented
            label="Barber"
            value={barberId ?? ""}
            options={data.barbers.map((b) => [b.id, b.name] as const)}
            onChange={setWeekBarber}
          />
        ) : null}

        <p className="ml-auto hidden text-xs text-muted xl:block">
          Drag a booking to move it · Click empty time to book
        </p>
      </div>

      {columns.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Nobody is taking bookings yet. Turn on bookings for a barber in Team.
        </p>
      ) : (
        <LayoutGroup>
          <motion.div
            layoutScroll
            ref={scroller}
            className="relative max-h-[calc(100dvh-15rem)] overflow-auto rounded-3xl border border-line bg-card shadow-sm md:max-h-[calc(100dvh-13.5rem)]"
          >
            <div
              className="grid min-w-full"
              style={{
                gridTemplateColumns: `4rem repeat(${columns.length}, minmax(${view === "week" ? "9.5rem" : "15rem"}, 1fr))`,
              }}
            >
              {/* Column headers */}
              <div className="sticky left-0 top-0 z-30 border-b border-line bg-card" />
              {columns.map((col) => (
                <ColumnHeader
                  key={`h-${col.key}`}
                  column={col}
                  view={view}
                  isToday={col.date === today}
                  appointments={appointments.filter(
                    (a) =>
                      a.staffId === col.barberId &&
                      DateTime.fromISO(a.startsAt, { zone: tz }).toISODate() === col.date,
                  )}
                  onOpenDay={() => {
                    setDate(col.date);
                    setView("day");
                  }}
                />
              ))}

              {/* Hour gutter */}
              <div
                className="sticky left-0 z-10 border-r border-line/60 bg-card"
                style={{ height: gridHeight }}
              >
                {range(hours.start, hours.end, 60).map((m) =>
                  m === hours.start || m === hours.end ? null : (
                    <span
                      key={m}
                      className="absolute right-2.5 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wide text-muted"
                      style={{ top: (m - hours.start) * PX }}
                    >
                      {formatClockMinutes(m)}
                    </span>
                  ),
                )}
              </div>

              {columns.map((col) => (
                <DayColumn
                  key={col.key}
                  column={col}
                  data={data}
                  appointments={appointments}
                  hours={hours}
                  height={gridHeight}
                  now={col.date === today ? wallMinutes(new Date(now), today, tz) : null}
                  nowMs={now}
                  ghost={ghost?.key === col.key ? ghost : null}
                  draggingId={ghost?.id ?? null}
                  canDrag={canDrag}
                  onSlot={(minutes) =>
                    newBooking({
                      staffId: col.barberId,
                      date: col.date,
                      minutes: snap(minutes, data.slotMinutes),
                    })
                  }
                  onSelect={(id) => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    setSelected(id);
                  }}
                  onBlockPointerDown={onBlockPointerDown}
                  onBlockPointerMove={onBlockPointerMove}
                  onBlockPointerUp={() => endDrag(true)}
                  onBlockPointerCancel={() => endDrag(false)}
                  barberName={barberName}
                />
              ))}
            </div>
          </motion.div>
        </LayoutGroup>
      )}

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={SPRING}
            className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-2xl md:bottom-8"
          >
            <span className="flex-1">{toast.text}</span>
            {toast.undo ? (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                className="rounded-full bg-paper/10 px-3 py-1 font-semibold hover:bg-paper/20"
              >
                Undo
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {draft ? (
        <BookingPanel
          draft={draft}
          calendar={data}
          menu={menu}
          onClose={() => setDraft(null)}
          onBooked={(bookedDate) => {
            setDraft(null);
            if (bookedDate !== date) setDate(bookedDate);
          }}
        />
      ) : null}

      {selectedAppointment ? (
        <AppointmentPanel
          key={selectedAppointment.id}
          appointment={selectedAppointment}
          calendar={data}
          onClose={() => setSelected(null)}
          onRebook={(prefill) => {
            setSelected(null);
            newBooking(prefill);
          }}
        />
      ) : null}
    </MotionConfig>
  );
}

/* -------------------------------------------------------------------------- */

function ColumnHeader(props: {
  column: Column;
  view: View;
  isToday: boolean;
  appointments: CalendarAppointment[];
  onOpenDay: () => void;
}) {
  const live = props.appointments.filter((a) => a.status !== "no_show");
  const value = live.reduce((sum, a) => sum + a.priceCents, 0);
  const summary = live.length
    ? `${live.length} booked · ${formatCents(value).replace(".00", "")}`
    : "Open";

  return (
    <div className="sticky top-0 z-20 border-b border-l border-line bg-card/95 px-3 py-2.5 backdrop-blur">
      {props.view === "week" ? (
        <button
          type="button"
          onClick={props.onOpenDay}
          className="group flex w-full items-center gap-2 text-left"
        >
          <span
            className={`grid size-9 place-items-center rounded-full font-display text-xl font-black transition-colors ${
              props.isToday
                ? "bg-brand text-brand-ink"
                : "bg-paper group-hover:bg-ink group-hover:text-paper"
            }`}
          >
            {props.column.subtitle}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
              {props.column.title}
            </span>
            <span className="block truncate text-xs text-muted">{summary}</span>
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2.5">
          <BarberAvatar name={props.column.title} />
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-bold uppercase leading-none">
              {props.column.title}
            </span>
            <span className="block truncate text-xs text-muted">{summary}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function DayColumn(props: {
  column: Column;
  data: CalendarData;
  appointments: CalendarAppointment[];
  hours: { start: number; end: number };
  height: number;
  now: number | null;
  nowMs: number;
  ghost: { id: string; start: number; duration: number } | null;
  draggingId: string | null;
  canDrag: (a: CalendarAppointment) => boolean;
  onSlot: (minutes: number) => void;
  onSelect: (id: string) => void;
  onBlockPointerDown: (a: CalendarAppointment, e: ReactPointerEvent<HTMLElement>) => void;
  onBlockPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onBlockPointerUp: () => void;
  onBlockPointerCancel: () => void;
  barberName: (id: string) => string;
}) {
  const { column, data, hours } = props;
  const tz = data.timezone;
  const barber = data.barbers.find((b) => b.id === column.barberId);
  const [hover, setHover] = useState<number | null>(null);

  const y = (minutes: number) => (Math.max(minutes, hours.start) - hours.start) * PX;
  const h = (s: number, e: number) =>
    Math.max(0, Math.min(e, hours.end) - Math.max(s, hours.start)) * PX;
  const toBlock = (s: string, e: string) => ({
    start: wallMinutes(s, column.date, tz),
    end: wallMinutes(e, column.date, tz),
  });
  const onDay = (b: { start: number; end: number }) => b.end > 0 && b.start < 24 * 60;

  const working = (barber?.working ?? []).map((w) => toBlock(w.start, w.end)).filter(onDay);
  const timeOff = (barber?.timeOff ?? [])
    .map((t) => ({ ...toBlock(t.start, t.end), reason: t.reason, id: t.id }))
    .filter(onDay);
  const blocks = lanes(
    props.appointments
      .filter((a) => a.staffId === column.barberId)
      .map((a) => ({ ...toBlock(a.startsAt, a.endsAt), appointment: a }))
      .filter(onDay),
  );

  const slotAt = (clientY: number, el: HTMLElement) =>
    hours.start + (clientY - el.getBoundingClientRect().top) / PX;
  const isBackground = (target: EventTarget, current: HTMLElement) =>
    target === current || (target instanceof HTMLElement && target.dataset.slot === "1");

  const step = props.data.slotMinutes;
  const hoverSlot =
    hover !== null && props.draggingId === null
      ? Math.min(snap(hover, step), hours.end - step)
      : null;

  return (
    <div
      data-col={column.key}
      role="presentation"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        setHover(
          isBackground(e.target, e.currentTarget) ? slotAt(e.clientY, e.currentTarget) : null,
        );
      }}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        if (isBackground(e.target, e.currentTarget))
          props.onSlot(slotAt(e.clientY, e.currentTarget));
      }}
      className="relative cursor-pointer border-l border-line bg-[repeating-linear-gradient(135deg,var(--color-paper)_0_8px,color-mix(in_oklch,var(--color-line)_45%,transparent)_8px_9px)]"
      style={{ height: props.height }}
    >
      {working.map((w, i) => (
        <div
          key={`w-${i}`}
          data-slot="1"
          className="absolute inset-x-0 bg-card"
          style={{ top: y(w.start), height: h(w.start, w.end) }}
        />
      ))}

      {range(hours.start, hours.end, 30).map((m) => (
        <div
          key={`l-${m}`}
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 border-t ${m % 60 ? "border-dashed border-line/40" : "border-line/80"}`}
          style={{ top: y(m) }}
        />
      ))}

      {hoverSlot !== null ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-1.5 z-[5] flex items-start rounded-lg border border-dashed border-ink/30 bg-ink/[0.03] px-2 py-1 text-xs font-semibold text-muted"
          style={{ top: y(hoverSlot) + 1, height: step * PX - 2 }}
        >
          + {formatClockMinutes(hoverSlot)}
        </div>
      ) : null}

      {timeOff.map((t) => (
        <div
          key={t.id}
          className="absolute inset-x-1.5 overflow-hidden rounded-xl border border-line bg-[repeating-linear-gradient(135deg,var(--color-line)_0_6px,var(--color-paper)_6px_12px)] p-2 text-xs font-semibold text-muted"
          style={{ top: y(t.start), height: h(t.start, t.end) }}
        >
          <span className="rounded-md bg-paper/95 px-1.5 py-0.5">
            Time off{t.reason ? ` · ${t.reason}` : ""}
          </span>
        </div>
      ))}

      {blocks.map(({ appointment: a, start, end, lane, laneCount }) => (
        <Block
          key={a.id}
          appointment={a}
          top={y(start) + 1}
          height={Math.max(h(start, end), 26) - 2}
          lane={lane}
          laneCount={laneCount}
          start={start}
          end={end}
          dimmed={props.draggingId === a.id}
          nowMs={props.nowMs}
          draggable={props.canDrag(a)}
          onSelect={props.onSelect}
          onPointerDown={props.onBlockPointerDown}
          onPointerMove={props.onBlockPointerMove}
          onPointerUp={props.onBlockPointerUp}
          onPointerCancel={props.onBlockPointerCancel}
        />
      ))}

      <AnimatePresence>
        {props.ghost ? (
          <motion.div
            key="ghost"
            aria-hidden
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1, top: y(props.ghost.start) + 1 }}
            exit={{ opacity: 0 }}
            transition={{ ...SPRING, opacity: { duration: 0.12 } }}
            className="pointer-events-none absolute inset-x-1.5 z-30 rounded-xl border-2 border-brand bg-brand/10 px-2.5 py-1.5 shadow-lg shadow-brand/20"
            style={{ height: props.ghost.duration * PX - 2 }}
          >
            <span className="rounded-md bg-brand px-1.5 py-0.5 text-xs font-bold text-brand-ink">
              {formatClockMinutes(props.ghost.start)} –{" "}
              {formatClockMinutes(props.ghost.start + props.ghost.duration)}
            </span>
            <span className="ml-1.5 text-xs font-semibold text-brand">
              {props.barberName(column.barberId)}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {props.now !== null && props.now >= hours.start && props.now <= hours.end ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-brand"
          style={{ top: y(props.now) }}
        >
          <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-brand" />
        </div>
      ) : null}
    </div>
  );
}

const BLOCK_STYLE: Record<string, string> = {
  confirmed:
    "bg-card text-ink ring-1 ring-line shadow-sm before:bg-ink hover:shadow-md hover:ring-ink/40",
  checked_in: "bg-brand text-brand-ink shadow-md shadow-brand/30 before:bg-ink/30",
  completed: "bg-paper text-muted ring-1 ring-line before:bg-line",
  no_show: "bg-danger/5 text-danger border border-dashed border-danger/50 before:bg-danger/60",
};

function Block(props: {
  appointment: CalendarAppointment;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
  start: number;
  end: number;
  dimmed: boolean;
  draggable: boolean;
  nowMs: number;
  onSelect: (id: string) => void;
  onPointerDown: (a: CalendarAppointment, e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const a = props.appointment;
  const tall = props.height >= 64;
  const roomy = props.height >= 96;
  const minutesIn =
    a.status === "checked_in" && a.checkedInAt
      ? Math.max(0, Math.floor((props.nowMs - Date.parse(a.checkedInAt)) / 60_000))
      : null;

  return (
    <motion.button
      layoutId={a.id}
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: props.dimmed ? 0.35 : 1, scale: 1 }}
      transition={SPRING}
      onClick={(e) => {
        e.stopPropagation();
        props.onSelect(a.id);
      }}
      onPointerDown={(e) => props.onPointerDown(a, e)}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      aria-label={`${a.client?.name ?? "Client"}, ${formatClockMinutes(props.start)} to ${formatClockMinutes(props.end)}, ${a.services.join(" and ")}`}
      className={`absolute z-10 flex select-none flex-col overflow-hidden rounded-xl py-1.5 pl-3.5 pr-2 text-left text-xs transition-shadow before:absolute before:inset-y-1.5 before:left-1.5 before:w-[3px] before:rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${BLOCK_STYLE[a.status] ?? BLOCK_STYLE.confirmed} ${props.draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        top: props.top,
        height: props.height,
        left: `calc(${(props.lane / props.laneCount) * 100}% + 6px)`,
        width: `calc(${100 / props.laneCount}% - 12px)`,
        touchAction: props.draggable ? "pan-y" : undefined,
      }}
    >
      <span className="flex items-center gap-1.5">
        <span className="shrink-0 font-semibold tabular-nums opacity-80">
          {formatClockMinutes(props.start)}
          {tall ? `–${formatClockMinutes(props.end)}` : ""}
        </span>
        {a.status === "checked_in" ? (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-ink/15 px-1.5 font-bold">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-current" />
            </span>
            {minutesIn}m
          </span>
        ) : a.paid ? (
          <span className="ml-auto font-bold" title="Paid">
            ✓ Paid
          </span>
        ) : null}
      </span>
      <span className={`truncate font-bold ${tall ? "text-sm" : ""}`}>
        {a.client?.name ?? "Client"}
      </span>
      {tall ? <span className="truncate opacity-80">{a.services.join(" + ")}</span> : null}
      {roomy ? (
        <span className="mt-auto flex items-center justify-between gap-2 opacity-80">
          <span>{a.source === "walk_in" ? "Walk-in" : ""}</span>
          <span className="font-semibold tabular-nums">{formatCents(a.priceCents)}</span>
        </span>
      ) : null}
    </motion.button>
  );
}

function IconButton(props: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      className="grid size-8 place-items-center rounded-full text-lg transition-colors hover:bg-paper"
    >
      {props.children}
    </button>
  );
}

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={props.label}
      className="relative flex rounded-full border border-line bg-card p-1 shadow-sm"
    >
      {props.options.map(([value, text]) => (
        <button
          key={value}
          type="button"
          aria-pressed={props.value === value}
          onClick={() => props.onChange(value)}
          className="relative rounded-full px-3 py-1 text-sm font-semibold text-muted transition-colors aria-pressed:text-paper"
        >
          {props.value === value ? (
            <motion.span
              layoutId={`seg-${props.label}`}
              className="absolute inset-0 rounded-full bg-ink"
              transition={SPRING}
            />
          ) : null}
          <span className="relative">{text}</span>
        </button>
      ))}
    </div>
  );
}

/** For a walk-in: the first barber not busy for the next 30 minutes, else the first barber. */
function freeBarberNow(data: CalendarData): string {
  const now = Date.now();
  const soon = now + 30 * 60_000;
  const busy = new Set(
    data.appointments
      .filter(
        (a) =>
          a.status !== "no_show" &&
          a.status !== "completed" &&
          Date.parse(a.startsAt) < soon &&
          now < Date.parse(a.endsAt),
      )
      .map((a) => a.staffId),
  );
  return (data.barbers.find((b) => !busy.has(b.id)) ?? data.barbers[0])?.id ?? "";
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
}
