"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useShop } from "@/components/shop-context";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Field,
  fieldErrors,
  Input,
  Notice,
  PageHeader,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";

type Detail = inferRouterOutputs<AppRouter>["team"]["detail"];
type Block = { start: string; end: string };

/** Monday-first, as barbers think about their week. Values are Postgres weekdays (0 = Sunday). */
const WEEK = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

export function MemberDetail({ staffId }: { staffId: string }) {
  const trpc = useTRPC();
  const shop = useShop();
  const { data } = useSuspenseQuery(trpc.team.detail.queryOptions({ shopId: shop.id, staffId }));
  const self = staffId === shop.staffId;

  return (
    <div>
      {shop.isManager ? (
        <Link
          href={`/dashboard/${shop.slug}/team` as Route}
          className="mb-3 inline-block text-sm font-semibold text-muted hover:text-ink"
        >
          ← Team
        </Link>
      ) : null}
      <PageHeader
        kicker={self ? "Your schedule" : shop.name}
        title={data.staff.name}
        description={
          !data.staff.pending
            ? undefined
            : data.staff.email
              ? `Invited as ${data.staff.email}. They get access the first time they sign in with that email.`
              : "No login yet. Add their email below to invite them."
        }
      />
      <div className="space-y-6">
        {data.canManage ? <ProfileCard staff={data.staff} /> : null}
        <HoursCard staffId={staffId} hours={data.hours} />
        <TimeOffCard staffId={staffId} timeOff={data.timeOff} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ProfileCard({ staff }: { staff: Detail["staff"] }) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const update = useMutation(trpc.team.update.mutationOptions());
  const [form, setForm] = useState({
    name: staff.name,
    email: staff.email ?? "",
    phone: staff.phone ?? "",
    bio: staff.bio ?? "",
    role: staff.role,
    isBookable: staff.isBookable,
    isActive: staff.isActive,
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setMessage(null);
    try {
      await update.mutateAsync({
        shopId: shop.id,
        staffId: staff.id,
        name: form.name,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        role: form.role,
        isBookable: form.isBookable,
        isActive: form.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: trpc.team.pathKey() });
      setMessage({ tone: "success", text: "Saved." });
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe);
      else setMessage({ tone: "error", text: (e as Error).message });
    }
  };

  return (
    <Card>
      <CardTitle
        action={
          staff.pending ? (
            <Badge tone={staff.email ? "brand" : "muted"}>
              {staff.email ? "Invited" : "No login"}
            </Badge>
          ) : null
        }
      >
        Profile
      </CardTitle>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="m-name" error={errors.name}>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Role" htmlFor="m-role">
            <Select
              id="m-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
              disabled={shop.role !== "owner" && staff.role === "owner"}
            >
              <option value="barber">Barber</option>
              <option value="manager">Manager</option>
              {shop.role === "owner" || staff.role === "owner" ? (
                <option value="owner">Owner</option>
              ) : null}
            </Select>
          </Field>
          <Field
            label="Email"
            htmlFor="m-email"
            error={errors.email}
            hint={staff.pending ? "They sign in with this to get access." : undefined}
          >
            <Input
              id="m-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone" htmlFor="m-phone" error={errors.phone}>
            <Input
              id="m-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field
            label="Bio (shown on the booking page)"
            htmlFor="m-bio"
            error={errors.bio}
            className="sm:col-span-2"
          >
            <Textarea
              id="m-bio"
              rows={2}
              maxLength={300}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Fades, designs, 10 years in Oak Cliff"
            />
          </Field>
        </div>
        <div className="space-y-4 rounded-xl bg-paper p-4">
          <Switch
            id="m-bookable"
            checked={form.isBookable}
            onChange={(v) => setForm({ ...form, isBookable: v })}
            label="Takes bookings"
            description="Turn off for owners or managers who don't cut."
          />
          <Switch
            id="m-active"
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
            label="Active"
            description="Turning this off removes their access and hides them from booking. History is kept."
          />
        </div>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Button type="submit" variant="primary" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function HoursCard({ staffId, hours }: { staffId: string; hours: Detail["hours"] }) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const save = useMutation(trpc.team.setHours.mutationOptions());
  const [week, setWeek] = useState<Record<number, Block[]>>(() => {
    const byDay: Record<number, Block[]> = {};
    for (const h of hours) (byDay[h.weekday] ??= []).push({ start: h.start, end: h.end });
    return byDay;
  });
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const setDay = (day: number, blocks: Block[]) => {
    setMessage(null);
    setWeek((w) => ({ ...w, [day]: blocks }));
  };

  const copyToWeekdays = (from: number) => {
    const blocks = week[from] ?? [];
    setWeek((w) => ({
      ...w,
      1: [...blocks],
      2: [...blocks],
      3: [...blocks],
      4: [...blocks],
      5: [...blocks],
    }));
  };

  const submit = async () => {
    setMessage(null);
    const rows = Object.entries(week).flatMap(([day, blocks]) =>
      blocks.map((b) => ({ weekday: Number(day), start: b.start, end: b.end })),
    );
    const bad = rows.find((r) => !r.start || !r.end || r.end <= r.start);
    if (bad) {
      setMessage({ tone: "error", text: "Each block needs an end time after its start." });
      return;
    }
    try {
      await save.mutateAsync({ shopId: shop.id, staffId, hours: rows });
      await queryClient.invalidateQueries({ queryKey: trpc.team.pathKey() });
      setMessage({ tone: "success", text: "Hours saved. The booking page uses them right away." });
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
  };

  return (
    <Card>
      <CardTitle>Weekly hours</CardTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">
        In the shop&apos;s timezone ({shop.timezone.replace("_", " ")}). Add a second block for a
        lunch break.
      </p>
      <ul className="divide-y divide-line">
        {WEEK.map(({ day, label }) => {
          const blocks = week[day] ?? [];
          const open = blocks.length > 0;
          return (
            <li key={day} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
              <label className="flex w-36 cursor-pointer items-center gap-3 pt-2 font-semibold">
                <input
                  type="checkbox"
                  checked={open}
                  onChange={(e) =>
                    setDay(day, e.target.checked ? [{ start: "10:00", end: "18:00" }] : [])
                  }
                  className="size-5 accent-[var(--color-ink)]"
                />
                {label}
              </label>
              <div className="flex-1 space-y-2">
                {open ? (
                  blocks.map((b, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${label} block ${i + 1} start`}
                        value={b.start}
                        step={900}
                        onChange={(e) =>
                          setDay(
                            day,
                            blocks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                          )
                        }
                        width="w-32"
                      />
                      <span className="text-muted">to</span>
                      <Input
                        type="time"
                        aria-label={`${label} block ${i + 1} end`}
                        value={b.end}
                        step={900}
                        onChange={(e) =>
                          setDay(
                            day,
                            blocks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                          )
                        }
                        width="w-32"
                      />
                      {blocks.length > 1 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${label} block ${i + 1}`}
                          onClick={() =>
                            setDay(
                              day,
                              blocks.filter((_, j) => j !== i),
                            )
                          }
                        >
                          ✕
                        </Button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="pt-2 text-muted">Closed</p>
                )}
                {open ? (
                  <div className="flex flex-wrap gap-3 text-sm">
                    <button
                      type="button"
                      className="font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                      onClick={() => {
                        const last = blocks[blocks.length - 1];
                        setDay(day, [...blocks, { start: last?.end ?? "13:00", end: "19:00" }]);
                      }}
                    >
                      + Add block
                    </button>
                    {day >= 1 && day <= 5 ? (
                      <button
                        type="button"
                        className="font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                        onClick={() => copyToWeekdays(day)}
                      >
                        Copy to Mon–Fri
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {message ? (
        <div className="mt-4">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      ) : null}
      <Button variant="primary" className="mt-4" disabled={save.isPending} onClick={submit}>
        {save.isPending ? "Saving…" : "Save hours"}
      </Button>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function TimeOffCard({ staffId, timeOff }: { staffId: string; timeOff: Detail["timeOff"] }) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.team.detail.pathKey() });
  const add = useMutation(trpc.team.addTimeOff.mutationOptions({ onSuccess: refresh }));
  const remove = useMutation(trpc.team.removeTimeOff.mutationOptions({ onSuccess: refresh }));

  const [wholeDays, setWholeDays] = useState(true);
  const [form, setForm] = useState(() => {
    const tomorrow = DateTime.now().setZone(shop.timezone).plus({ days: 1 }).toISODate() ?? "";
    return { from: tomorrow, to: tomorrow, start: "12:00", end: "14:00", reason: "" };
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const zone = { zone: shop.timezone };
    const start = wholeDays
      ? DateTime.fromISO(form.from, zone).startOf("day")
      : DateTime.fromISO(`${form.from}T${form.start}`, zone);
    const end = wholeDays
      ? DateTime.fromISO(form.to, zone).plus({ days: 1 }).startOf("day")
      : DateTime.fromISO(`${form.from}T${form.end}`, zone);
    if (!start.isValid || !end.isValid || end <= start) {
      setError("Check the dates: the end has to be after the start.");
      return;
    }
    try {
      await add.mutateAsync({
        shopId: shop.id,
        staffId,
        start: start.toISO() ?? "",
        end: end.toISO() ?? "",
        reason: form.reason.trim() || undefined,
      });
      setForm((f) => ({ ...f, reason: "" }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const describe = (t: Detail["timeOff"][number]) => {
    const start = DateTime.fromISO(t.start, { zone: shop.timezone });
    const end = DateTime.fromISO(t.end, { zone: shop.timezone });
    const allDay = start.equals(start.startOf("day")) && end.equals(end.startOf("day"));
    if (allDay) {
      const last = end.minus({ days: 1 });
      return last.hasSame(start, "day")
        ? start.toFormat("ccc, LLL d")
        : `${start.toFormat("ccc, LLL d")} – ${last.toFormat("ccc, LLL d")}`;
    }
    return `${start.toFormat("ccc, LLL d, h:mm a")} – ${end.toFormat(end.hasSame(start, "day") ? "h:mm a" : "ccc, LLL d, h:mm a")}`;
  };

  return (
    <Card>
      <CardTitle>Time off</CardTitle>
      {timeOff.length ? (
        <ul className="mb-5 divide-y divide-line rounded-xl border border-line">
          {timeOff.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <p className="font-semibold">{describe(t)}</p>
                {t.reason ? <p className="text-sm text-muted">{t.reason}</p> : null}
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ shopId: shop.id, timeOffId: t.id })}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-muted">Nothing booked off.</p>
      )}

      <form onSubmit={submit} noValidate className="space-y-4 rounded-xl bg-paper p-4">
        <Switch id="to-whole" checked={wholeDays} onChange={setWholeDays} label="Whole days" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={wholeDays ? "From" : "Date"} htmlFor="to-from">
            <Input
              id="to-from"
              type="date"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
            />
          </Field>
          {wholeDays ? (
            <Field label="To (inclusive)" htmlFor="to-to">
              <Input
                id="to-to"
                type="date"
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            </Field>
          ) : (
            <>
              <Field label="From" htmlFor="to-start">
                <Input
                  id="to-start"
                  type="time"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </Field>
              <Field label="To" htmlFor="to-end">
                <Input
                  id="to-end"
                  type="time"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field
            label="Reason (optional)"
            htmlFor="to-reason"
            className={wholeDays ? "" : "sm:col-span-3"}
          >
            <Input
              id="to-reason"
              value={form.reason}
              maxLength={120}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Vacation, appointment…"
            />
          </Field>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button type="submit" variant="primary" disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add time off"}
        </Button>
        <p className="text-sm text-muted">
          Existing bookings aren&apos;t cancelled automatically. Check the day view and move or
          cancel them.
        </p>
      </form>
    </Card>
  );
}
