"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useShop } from "@/components/shop-context";
import { Button, PageHeader } from "@/components/ui";
import {
  addDays,
  dateRange,
  formatClockMinutes,
  lanes,
  snap,
  todayIn,
  visibleHours,
  wallMinutes,
  weekStart,
} from "@/lib/calendar/grid";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";
import { AppointmentPanel } from "./appointment-panel";
import { BookingPanel, type BookingDraft } from "./booking-panel";

export type CalendarData = inferRouterOutputs<AppRouter>["calendar"]["range"];
export type Menu = inferRouterOutputs<AppRouter>["services"]["list"];
export type CalendarAppointment = CalendarData["appointments"][number];

type View = "day" | "week";

/** Pixels per minute of the grid: 64px an hour. */
const PX = 64 / 60;

const STATUS_BLOCK: Record<string, string> = {
  confirmed: "border-ink/70 bg-card text-ink hover:border-ink",
  checked_in: "border-brand bg-brand text-brand-ink",
  completed: "border-line bg-paper text-muted",
  no_show: "border-dashed border-danger/60 bg-danger/5 text-danger",
};

type Column = { key: string; date: string; barberId: string; title: string; subtitle?: string };

export function CalendarView(props: {
  initialDate: string;
  initialView: View;
  today: string;
  openWalkIn: boolean;
}) {
  const trpc = useTRPC();
  const shop = useShop();

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

  const barberId = weekBarber ?? data.barbers[0]?.id ?? null;
  const today = todayIn(data.timezone);
  const now = useNow();

  // "?walkin=1" (the Today board's Walk-in button) opens the walk-in form.
  const [draft, setDraft] = useState<BookingDraft | null>(() =>
    props.openWalkIn
      ? {
          staffId: data.viewer.isManager ? freeBarberNow(data) : data.viewer.staffId,
          date: today,
          minutes: snap(wallMinutes(new Date(), today, data.timezone), 5),
          walkIn: true,
        }
      : null,
  );

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

  const tz = data.timezone;
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
    for (const a of data.appointments) {
      const d = DateTime.fromISO(a.startsAt, { zone: tz }).toISODate();
      if (!d || !columns.some((c) => c.date === d)) continue;
      ranges.push({ start: wallMinutes(a.startsAt, d, tz), end: wallMinutes(a.endsAt, d, tz) });
    }
    return visibleHours(ranges);
  }, [columns, data, tz]);

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
    el.scrollTop = Math.max(0, (focus - hours.start) * PX);
  }, [columns, hours.start, start, today, tz, view]);

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
      });
    },
    [barberId, data, date, hours.start, today, tz],
  );

  const heading =
    view === "day"
      ? DateTime.fromISO(date).toFormat("cccc, LLL d")
      : `${DateTime.fromISO(start).toFormat("LLL d")} – ${DateTime.fromISO(addDays(start, 6)).toFormat("LLL d")}`;

  const selectedAppointment = data.appointments.find((a) => a.id === selected) ?? null;
  const gridHeight = (hours.end - hours.start) * PX;

  return (
    <>
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
              Walk-in
            </Button>
            <Button variant="primary" onClick={() => newBooking()}>
              New booking
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-line bg-card p-1">
          <button
            type="button"
            aria-label={view === "day" ? "Previous day" : "Previous week"}
            onClick={() => setDate(addDays(date, view === "day" ? -1 : -7))}
            className="grid size-8 place-items-center rounded-full hover:bg-paper"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="rounded-full px-3 py-1 text-sm font-semibold hover:bg-paper disabled:text-muted"
            disabled={view === "day" ? date === today : weekStart(today) === start}
          >
            Today
          </button>
          <button
            type="button"
            aria-label={view === "day" ? "Next day" : "Next week"}
            onClick={() => setDate(addDays(date, view === "day" ? 1 : 7))}
            className="grid size-8 place-items-center rounded-full hover:bg-paper"
          >
            ›
          </button>
        </div>

        <input
          type="date"
          aria-label="Go to date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-sm"
        />

        <div
          role="group"
          aria-label="View"
          className="flex rounded-full border border-line bg-card p-1"
        >
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className="rounded-full px-3 py-1 text-sm font-semibold capitalize text-muted aria-pressed:bg-ink aria-pressed:text-paper"
            >
              {v}
            </button>
          ))}
        </div>

        {view === "week" && data.barbers.length > 1 ? (
          <select
            aria-label="Barber"
            value={barberId ?? ""}
            onChange={(e) => setWeekBarber(e.target.value)}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold"
          >
            {data.barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}

        <Legend />
      </div>

      {columns.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Nobody is taking bookings yet. Turn on bookings for a barber in Team.
        </p>
      ) : (
        <div
          ref={scroller}
          className="relative max-h-[calc(100dvh-15rem)] overflow-auto rounded-2xl border border-line bg-card md:max-h-[calc(100dvh-13rem)]"
        >
          <div
            className="grid min-w-full"
            style={{
              gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(${view === "week" ? "7.5rem" : "10rem"}, 1fr))`,
            }}
          >
            {/* Column headers */}
            <div className="sticky left-0 top-0 z-30 border-b border-line bg-card" />
            {columns.map((col) => {
              const isToday = col.date === today;
              return (
                <div
                  key={`h-${col.key}`}
                  className="sticky top-0 z-20 border-b border-l border-line bg-card/95 px-3 py-2 backdrop-blur"
                >
                  {view === "week" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDate(col.date);
                        setView("day");
                      }}
                      className="flex items-baseline gap-1.5 font-semibold hover:text-brand"
                    >
                      <span className="text-sm uppercase tracking-wide text-muted">
                        {col.title}
                      </span>
                      <span
                        className={
                          isToday
                            ? "grid size-7 place-items-center rounded-full bg-brand font-display text-lg text-brand-ink"
                            : "font-display text-xl"
                        }
                      >
                        {col.subtitle}
                      </span>
                    </button>
                  ) : (
                    <p className="truncate font-display text-xl font-bold uppercase">{col.title}</p>
                  )}
                </div>
              );
            })}

            {/* Hour gutter */}
            <div className="sticky left-0 z-10 bg-card" style={{ height: gridHeight }}>
              {range(hours.start, hours.end, 60).map((m) => (
                <span
                  key={m}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-muted"
                  style={{ top: (m - hours.start) * PX }}
                >
                  {m === hours.start || m === hours.end ? "" : formatClockMinutes(m)}
                </span>
              ))}
            </div>

            {columns.map((col) => (
              <DayColumn
                key={col.key}
                column={col}
                data={data}
                hours={hours}
                height={gridHeight}
                now={col.date === today ? wallMinutes(now, today, tz) : null}
                onSlot={(minutes) =>
                  newBooking({
                    staffId: col.barberId,
                    date: col.date,
                    minutes: snap(minutes, data.slotMinutes),
                  })
                }
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      )}

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
          appointment={selectedAppointment}
          calendar={data}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

function DayColumn(props: {
  column: Column;
  data: CalendarData;
  hours: { start: number; end: number };
  height: number;
  now: number | null;
  onSlot: (minutes: number) => void;
  onSelect: (id: string) => void;
}) {
  const { column, data, hours } = props;
  const tz = data.timezone;
  const barber = data.barbers.find((b) => b.id === column.barberId);
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
  const appointments = lanes(
    props.data.appointments
      .filter((a) => a.staffId === column.barberId)
      .map((a) => ({ ...toBlock(a.startsAt, a.endsAt), appointment: a }))
      .filter(onDay),
  );

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.slot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    props.onSlot(hours.start + (e.clientY - rect.top) / PX);
  };

  return (
    <div
      role="presentation"
      onClick={handleClick}
      className="relative cursor-copy border-l border-line bg-[repeating-linear-gradient(135deg,var(--color-paper)_0_8px,color-mix(in_oklch,var(--color-line)_45%,transparent)_8px_9px)]"
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
          className={`pointer-events-none absolute inset-x-0 border-t ${m % 60 ? "border-dashed border-line/50" : "border-line/80"}`}
          style={{ top: y(m) }}
        />
      ))}

      {timeOff.map((t) => (
        <div
          key={t.id}
          className="absolute inset-x-1 overflow-hidden rounded-lg border border-line bg-[repeating-linear-gradient(135deg,var(--color-line)_0_6px,var(--color-paper)_6px_12px)] px-2 py-1 text-xs font-semibold text-muted"
          style={{ top: y(t.start), height: h(t.start, t.end) }}
        >
          <span className="rounded bg-paper/90 px-1">
            Time off{t.reason ? ` · ${t.reason}` : ""}
          </span>
        </div>
      ))}

      {appointments.map(({ appointment: a, start, end, lane, laneCount }) => {
        const height = Math.max(h(start, end), 22);
        const compact = height < 44;
        return (
          <button
            key={a.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onSelect(a.id);
            }}
            className={`absolute z-10 overflow-hidden rounded-lg border-l-4 border px-2 text-left text-xs shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand ${STATUS_BLOCK[a.status] ?? STATUS_BLOCK.confirmed} ${compact ? "py-0.5" : "py-1"}`}
            style={{
              top: y(start) + 1,
              height: height - 2,
              left: `calc(${(lane / laneCount) * 100}% + 3px)`,
              width: `calc(${100 / laneCount}% - 6px)`,
            }}
          >
            <span className="flex items-baseline gap-1.5">
              <span className="shrink-0 font-semibold tabular-nums">
                {formatClockMinutes(start)}
              </span>
              <span className="truncate font-semibold">{a.client?.name ?? "Client"}</span>
            </span>
            {compact ? null : (
              <span className="block truncate opacity-80">
                {a.source === "walk_in" ? "Walk-in · " : ""}
                {a.services.join(" + ")}
              </span>
            )}
          </button>
        );
      })}

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

function Legend() {
  const items = [
    ["Booked", "border-ink/70 bg-card"],
    ["In the chair", "border-brand bg-brand"],
    ["Done", "border-line bg-paper"],
  ] as const;
  return (
    <ul className="ml-auto hidden items-center gap-3 text-xs text-muted lg:flex">
      {items.map(([label, cls]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded border-l-4 border ${cls}`} />
          {label}
        </li>
      ))}
    </ul>
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

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
}

/** The current time, refreshed every 30 seconds for the "now" line. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
