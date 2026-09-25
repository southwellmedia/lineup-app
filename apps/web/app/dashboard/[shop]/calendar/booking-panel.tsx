"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import { Sheet } from "@/components/sheet";
import { useShop } from "@/components/shop-context";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { formatPhone } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { instantAt, wallMinutes } from "@/lib/calendar/grid";
import { useTRPC } from "@/trpc/client";
import type { CalendarData, Menu } from "./calendar-view";

export type BookingDraft = {
  staffId: string;
  date: string;
  minutes: number;
  walkIn: boolean;
  /** Rebooking: start with this client and these services picked. */
  client?: { id: string; name: string; phone: string | null };
  serviceIds?: string[];
};

const SOURCES = [
  ["walk_in", "Walk-in"],
  ["phone", "Phone call"],
  ["instagram", "Instagram DM"],
  ["google", "Google"],
  ["referral", "Referral"],
  ["other", "Other"],
] as const;
type Source = (typeof SOURCES)[number][0];

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const fromTime = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function BookingPanel(props: {
  draft: BookingDraft;
  calendar: CalendarData;
  menu: Menu;
  onClose: () => void;
  onBooked: (date: string) => void;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const { calendar, menu, draft } = props;

  const [staffId, setStaffId] = useState(draft.staffId);
  const [date, setDate] = useState(draft.date);
  const [time, setTime] = useState(toTime(draft.minutes));
  const [serviceIds, setServiceIds] = useState<string[]>(draft.serviceIds ?? []);
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    draft.walkIn && !draft.client ? "new" : "existing",
  );
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string; phone: string | null } | null>(
    draft.client ?? null,
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<Source>(draft.walkIn ? "walk_in" : "phone");
  const [note, setNote] = useState("");
  const [checkIn, setCheckIn] = useState(draft.walkIn);
  const [textsOk, setTextsOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offered = useMemo(
    () =>
      menu.services
        .filter((s) => s.isActive)
        .flatMap((s) => {
          const offer = s.offeredBy.find((o) => o.staffId === staffId);
          return offer
            ? [
                {
                  id: s.id,
                  name: s.name,
                  isAddon: s.isAddon,
                  durationMinutes: offer.durationMinutes ?? s.durationMinutes,
                  priceCents: offer.priceCents ?? s.priceCents,
                },
              ]
            : [];
        }),
    [menu.services, staffId],
  );
  const chosen = offered.filter((s) => serviceIds.includes(s.id));
  const duration = chosen.reduce((sum, s) => sum + s.durationMinutes, 0);
  const price = chosen.reduce((sum, s) => sum + s.priceCents, 0);
  const hasMain = chosen.some((s) => !s.isAddon);

  const deferredSearch = useDeferredValue(search.trim());
  const results = useQuery(
    trpc.clients.list.queryOptions(
      { shopId: shop.id, search: deferredSearch },
      { enabled: clientMode === "existing" && deferredSearch.length >= 2 },
    ),
  );

  // Advisory checks against what the calendar already shows. The server and
  // database make the real decision.
  const barber = calendar.barbers.find((b) => b.id === staffId);
  const startMinutes = fromTime(time);
  const warnings: string[] = [];
  if (barber && duration > 0) {
    const endMinutes = startMinutes + duration;
    const tz = calendar.timezone;
    const windows = barber.working.map((w) => ({
      start: wallMinutes(w.start, date, tz),
      end: wallMinutes(w.end, date, tz),
    }));
    const loaded = windows.length > 0 || calendar.appointments.length > 0;
    if (loaded && !windows.some((w) => w.start <= startMinutes && endMinutes <= w.end)) {
      warnings.push(`That's outside ${barber.name}'s working hours. You can still book it.`);
    }
    const clash = calendar.appointments.find(
      (a) =>
        a.staffId === staffId &&
        a.status !== "no_show" &&
        wallMinutes(a.startsAt, date, tz) < endMinutes &&
        startMinutes < wallMinutes(a.endsAt, date, tz),
    );
    if (clash)
      warnings.push(`${barber.name} already has ${clash.client?.name ?? "a client"} then.`);
  }

  const book = useMutation(
    trpc.calendar.book.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.calendar.range.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.schedule.day.pathKey() }),
        ]);
        props.onBooked(date);
      },
      onError: (e) =>
        setError(
          e.data?.code === "CONFLICT"
            ? "That time is already taken. Pick another time or barber."
            : e.message,
        ),
    }),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!hasMain) return setError("Pick at least one service.");
    if (clientMode === "existing" && !picked) return setError("Pick a client, or add a new one.");
    if (clientMode === "new" && !name.trim()) return setError("Add the client's name.");
    book.mutate({
      shopId: shop.id,
      staffId,
      startsAt: instantAt(date, startMinutes, calendar.timezone).toISOString(),
      serviceIds,
      client:
        clientMode === "existing" && picked
          ? { kind: "existing", id: picked.id }
          : { kind: "new", name: name.trim(), phone: phone.trim() },
      source,
      note: note.trim() || undefined,
      checkIn: checkIn && source === "walk_in",
      textsOk,
    });
  };

  return (
    <Sheet
      title={draft.walkIn ? "Walk-in" : draft.client ? "Book again" : "New booking"}
      onClose={props.onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {calendar.viewer.isManager && calendar.barbers.length > 1 ? (
            <Field label="Barber" htmlFor="b-barber" className="col-span-2">
              <Select
                id="b-barber"
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setServiceIds([]);
                }}
              >
                {calendar.barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Date" htmlFor="b-date">
            <Input
              id="b-date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </Field>
          <Field label="Time" htmlFor="b-time">
            <Input
              id="b-time"
              type="time"
              step={300}
              value={time}
              onChange={(e) => e.target.value && setTime(e.target.value)}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Services</legend>
          {offered.length === 0 ? (
            <p className="text-sm text-muted">This barber doesn&apos;t offer any services yet.</p>
          ) : (
            <ul className="grid gap-2">
              {offered.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${on ? "border-ink bg-paper" : "border-line hover:border-ink/50"}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setServiceIds((ids) =>
                            on ? ids.filter((id) => id !== s.id) : [...ids, s.id],
                          )
                        }
                        className="size-4 accent-[var(--color-ink)]"
                      />
                      <span className="flex-1">
                        <span className="font-semibold">{s.name}</span>
                        {s.isAddon ? (
                          <span className="ml-1.5 text-xs text-muted">add-on</span>
                        ) : null}
                        <span className="block text-sm text-muted">{s.durationMinutes} min</span>
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCents(s.priceCents)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-3">
            <legend className="text-sm font-semibold">Client</legend>
            <div
              role="group"
              aria-label="Client"
              className="flex rounded-full bg-paper p-0.5 ring-1 ring-line"
            >
              {(
                [
                  ["existing", "Find"],
                  ["new", "New"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={clientMode === mode}
                  onClick={() => setClientMode(mode)}
                  className="rounded-full px-3 py-0.5 text-sm font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-paper"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {clientMode === "existing" ? (
            picked ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-ink bg-paper px-3.5 py-2.5">
                <span>
                  <span className="font-semibold">{picked.name}</span>
                  {picked.phone ? (
                    <span className="block text-sm text-muted">{formatPhone(picked.phone)}</span>
                  ) : null}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  aria-label="Search clients by name or phone"
                  placeholder="Search by name or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoComplete="off"
                />
                {deferredSearch.length >= 2 ? (
                  <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line">
                    {(results.data ?? []).slice(0, 8).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setPicked({ id: c.id, name: c.name, phone: c.phone })}
                          className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-paper"
                        >
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-sm text-muted">
                            {c.phone ? formatPhone(c.phone) : "No phone"}
                          </span>
                        </button>
                      </li>
                    ))}
                    {results.data && results.data.length === 0 ? (
                      <li className="px-3.5 py-2 text-sm text-muted">
                        No match.{" "}
                        <button
                          type="button"
                          className="font-semibold text-ink underline underline-offset-4"
                          onClick={() => {
                            setClientMode("new");
                            if (/\d{3}/.test(search)) setPhone(search);
                            else setName(search);
                          }}
                        >
                          Add them as new
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </>
            )
          ) : (
            <div className="grid gap-3">
              <Field label="Name" htmlFor="b-name">
                <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field
                label={source === "walk_in" ? "Mobile number (optional)" : "Mobile number"}
                htmlFor="b-phone"
                hint="A returning number is matched to their existing profile."
              >
                <Input
                  id="b-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Came from" htmlFor="b-source">
            <Select
              id="b-source"
              value={source}
              onChange={(e) => {
                const next = e.target.value as Source;
                setSource(next);
                if (next !== "walk_in") setCheckIn(false);
              }}
            >
              {SOURCES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {source === "walk_in" ? (
            <label className="mt-7 flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={checkIn}
                onChange={(e) => setCheckIn(e.target.checked)}
                className="size-4 accent-[var(--color-ink)]"
              />
              In the chair now
            </label>
          ) : null}
        </div>

        {source !== "walk_in" ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={textsOk}
              onChange={(e) => setTextsOk(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-ink)]"
            />
            <span>
              <span className="font-semibold">Client agrees to texts</span>
              <span className="block text-muted">
                Confirmation and reminders by SMS. Ask them first.
              </span>
            </span>
          </label>
        ) : null}

        <Field label="Note (optional)" htmlFor="b-note">
          <Textarea
            id="b-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16"
          />
        </Field>

        {warnings.map((w) => (
          <p key={w} className="rounded-xl bg-paper px-4 py-3 text-sm font-medium ring-1 ring-line">
            {w}
          </p>
        ))}
        {error ? <Notice tone="error">{error}</Notice> : null}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-muted">
            {duration ? (
              <>
                <span className="font-semibold text-ink">{duration} min</span> ·{" "}
                <span className="font-semibold text-ink">{formatCents(price)}</span>
              </>
            ) : (
              "Pick a service"
            )}
          </p>
          <Button type="submit" variant="primary" disabled={book.isPending}>
            {book.isPending ? "Booking…" : draft.walkIn ? "Add walk-in" : "Book"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
