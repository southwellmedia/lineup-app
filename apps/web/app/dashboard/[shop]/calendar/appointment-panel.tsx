"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Sheet } from "@/components/sheet";
import { useShop } from "@/components/shop-context";
import { Badge, Button, Field, Input, Notice, Select } from "@/components/ui";
import { instantAt } from "@/lib/calendar/grid";
import { formatPhone, sourceLabel } from "@/lib/dashboard/summary";
import { useTRPC } from "@/trpc/client";
import type { CalendarAppointment, CalendarData } from "./calendar-view";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Booked",
  checked_in: "In the chair",
  completed: "Done",
  no_show: "No-show",
};

export function AppointmentPanel(props: {
  appointment: CalendarAppointment;
  calendar: CalendarData;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const { appointment: a, calendar } = props;
  const tz = calendar.timezone;

  const start = DateTime.fromISO(a.startsAt, { zone: tz });
  const end = DateTime.fromISO(a.endsAt, { zone: tz });
  const barber = calendar.barbers.find((b) => b.id === a.staffId);
  const canChange = a.status === "confirmed";

  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(start.toISODate() ?? "");
  const [time, setTime] = useState(start.toFormat("HH:mm"));
  const [staffId, setStaffId] = useState(a.staffId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.calendar.range.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.schedule.day.pathKey() }),
    ]);
  const onError = (e: { message: string; data?: { code?: string } | null }) =>
    setError(
      e.data?.code === "CONFLICT"
        ? "That time is already taken. Try another time or barber."
        : e.message,
    );

  const reschedule = useMutation(
    trpc.calendar.reschedule.mutationOptions({
      onSuccess: async () => {
        await refresh();
        props.onClose();
      },
      onError,
    }),
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

  const submitMove = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const [h, m] = time.split(":").map(Number);
    const minutes = (h ?? 0) * 60 + (m ?? 0);
    const startsAt = instantAt(date, minutes, tz);
    reschedule.mutate({
      shopId: shop.id,
      appointmentId: a.id,
      staffId,
      startsAt: startsAt.toISOString(),
    });
  };

  const day = start.toISODate() ?? "";

  return (
    <Sheet title={a.client?.name ?? "Appointment"} onClose={props.onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={
              a.status === "checked_in" ? "brand" : a.status === "no_show" ? "danger" : "neutral"
            }
          >
            {STATUS_LABEL[a.status] ?? a.status}
          </Badge>
          <Badge tone="muted">{sourceLabel(a.source)}</Badge>
        </div>

        <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2.5">
          <dt className="text-muted">When</dt>
          <dd className="font-semibold">
            {start.toFormat("ccc, LLL d")} · {start.toFormat("h:mm a")}–{end.toFormat("h:mm a")}
          </dd>
          <dt className="text-muted">Barber</dt>
          <dd className="font-semibold">{barber?.name ?? "—"}</dd>
          <dt className="text-muted">Services</dt>
          <dd className="font-semibold">{a.services.join(" + ") || "—"}</dd>
          {a.client?.phone ? (
            <>
              <dt className="text-muted">Phone</dt>
              <dd>
                <a
                  href={`tel:${a.client.phone}`}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {formatPhone(a.client.phone)}
                </a>
              </dd>
            </>
          ) : null}
          {a.note ? (
            <>
              <dt className="text-muted">Note</dt>
              <dd>{a.note}</dd>
            </>
          ) : null}
        </dl>

        <Link
          href={`/dashboard/${shop.slug}?date=${day}` as Route}
          className="inline-block text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
        >
          Check in or take payment on the Today board →
        </Link>

        {error ? <Notice tone="error">{error}</Notice> : null}

        {canChange && moving ? (
          <form onSubmit={submitMove} className="space-y-3 rounded-2xl border border-line p-4">
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
              {calendar.viewer.isManager && calendar.barbers.length > 1 ? (
                <Field label="Barber" htmlFor="m-barber" className="col-span-2">
                  <Select
                    id="m-barber"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                  >
                    {calendar.barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMoving(false)}>
                Back
              </Button>
              <Button type="submit" variant="primary" disabled={reschedule.isPending}>
                {reschedule.isPending ? "Moving…" : "Move booking"}
              </Button>
            </div>
          </form>
        ) : null}

        {canChange && !moving ? (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="primary" onClick={() => setMoving(true)}>
              Move
            </Button>
            {confirmCancel ? (
              <>
                <Button
                  variant="danger"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate({ appointmentId: a.id })}
                >
                  {cancel.isPending ? "Cancelling…" : "Yes, cancel it"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                Cancel booking
              </Button>
            )}
          </div>
        ) : null}

        {!canChange ? (
          <p className="border-t border-line pt-4 text-sm text-muted">
            Only bookings that haven&apos;t started can be moved or cancelled.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
