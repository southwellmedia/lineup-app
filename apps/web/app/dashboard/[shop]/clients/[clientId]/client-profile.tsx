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
  Textarea,
} from "@/components/ui";
import { formatPhone, sourceLabel, STATUS_LABEL } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import { ClientPhotoGallery } from "../../photos";
import type { AppRouter } from "@/trpc/router";

type Detail = inferRouterOutputs<AppRouter>["clients"]["detail"];

export function ClientProfile({ clientId }: { clientId: string }) {
  const trpc = useTRPC();
  const shop = useShop();
  const { data } = useSuspenseQuery(
    trpc.clients.detail.queryOptions({ shopId: shop.id, clientId }),
  );
  const [editing, setEditing] = useState(false);
  const { client, stats } = data;
  const fmt = (iso: string | null, format: string) =>
    iso ? DateTime.fromISO(iso, { zone: shop.timezone }).toFormat(format) : "—";

  return (
    <div>
      <Link
        href={`/dashboard/${shop.slug}/clients` as Route}
        className="mb-3 inline-block text-sm font-semibold text-muted hover:text-ink"
      >
        ← Clients
      </Link>
      <PageHeader
        kicker={`Client since ${fmt(client.since, "LLLL yyyy")}`}
        title={client.name}
        action={editing ? null : <Button onClick={() => setEditing(true)}>Edit</Button>}
      />

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-lg">
        {client.phone ? (
          <a
            href={`tel:${client.phone}`}
            className="font-semibold underline-offset-4 hover:underline"
          >
            {formatPhone(client.phone)}
          </a>
        ) : (
          <span className="text-muted">No phone number</span>
        )}
        {client.email ? (
          <a
            href={`mailto:${client.email}`}
            className="text-muted underline-offset-4 hover:underline"
          >
            {client.email}
          </a>
        ) : null}
        {client.instagram ? (
          <a
            href={`https://instagram.com/${client.instagram}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted underline-offset-4 hover:underline"
          >
            @{client.instagram}
          </a>
        ) : null}
        {client.isMinor ? <Badge tone="neutral">Under 18</Badge> : null}
        <Badge tone={client.textsAllowed ? "ink" : "muted"}>
          {client.textsAllowed ? "Texts OK" : "No texts"}
        </Badge>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Visits" value={String(stats.visits)} />
        <Stat label="Spent" value={formatCents(stats.spentCents)} />
        <Stat label="Last visit" value={fmt(stats.lastVisitAt, "LLL d")} />
        <Stat
          label="No-shows"
          value={String(stats.noShows)}
          tone={stats.noShows ? "danger" : undefined}
        />
      </dl>

      {editing ? (
        <EditClient data={data} onClose={() => setEditing(false)} />
      ) : client.notes ? (
        <Card className="mb-6">
          <p className="text-muted">Notes</p>
          <p className="whitespace-pre-line">{client.notes}</p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardTitle>Photos</CardTitle>
        <ClientPhotoGallery
          clientId={client.id}
          isMinor={client.isMinor}
          clientInstagram={client.instagram}
        />
      </Card>

      <Card>
        <CardTitle>History</CardTitle>
        {data.history.length === 0 ? (
          <p className="text-muted">No appointments yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <p className="w-36 font-semibold tabular-nums">{fmt(a.startsAt, "LLL d, yyyy")}</p>
                <p className="min-w-0 flex-1">
                  {a.services.join(" + ")}
                  <span className="text-muted">
                    {" "}
                    · {a.barber} · via {sourceLabel(a.source)}
                  </span>
                </p>
                <Badge
                  tone={
                    a.status === "completed"
                      ? "ink"
                      : a.status === "no_show"
                        ? "danger"
                        : a.status === "cancelled"
                          ? "muted"
                          : "neutral"
                  }
                >
                  {STATUS_LABEL[a.status]}
                </Badge>
                <p className="w-20 text-right font-semibold tabular-nums">
                  {formatCents(a.priceCents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd
        className={`text-2xl font-bold tracking-tight tabular-nums ${tone === "danger" ? "text-danger" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function EditClient({ data, onClose }: { data: Detail; onClose: () => void }) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const update = useMutation(trpc.clients.update.mutationOptions());
  const c = data.client;
  const [form, setForm] = useState({
    name: c.name,
    phone: c.phone ? formatPhone(c.phone) : "",
    email: c.email ?? "",
    notes: c.notes ?? "",
    preferredStaffId: c.preferredStaffId ?? "",
    instagram: c.instagram ?? "",
    isMinor: c.isMinor,
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setError(null);
    try {
      await update.mutateAsync({
        shopId: shop.id,
        clientId: c.id,
        name: form.name,
        phone: form.phone,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        preferredStaffId: form.preferredStaffId || null,
        instagram: form.instagram,
        isMinor: form.isMinor,
      });
      await queryClient.invalidateQueries({ queryKey: trpc.clients.pathKey() });
      onClose();
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe);
      else setError((e as Error).message);
    }
  };

  return (
    <Card className="mb-6 animate-rise border-ink shadow-[4px_4px_0_0_var(--color-ink)]">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="e-name" error={errors.name}>
            <Input
              id="e-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Mobile number" htmlFor="e-phone" error={errors.phone}>
            <Input
              id="e-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email" htmlFor="e-email" error={errors.email}>
            <Input
              id="e-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Preferred barber" htmlFor="e-pref">
            <Select
              id="e-pref"
              value={form.preferredStaffId}
              onChange={(e) => setForm({ ...form, preferredStaffId: e.target.value })}
            >
              <option value="">No preference</option>
              {data.barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Instagram"
            htmlFor="e-ig"
            error={errors.instagram}
            hint="Only for tagging photos they've agreed to share."
          >
            <Input
              id="e-ig"
              value={form.instagram}
              placeholder="@handle"
              autoComplete="off"
              onChange={(e) => setForm({ ...form, instagram: e.target.value })}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.isMinor}
              onChange={(e) => setForm({ ...form, isMinor: e.target.checked })}
              className="size-4 accent-[var(--color-ink)]"
            />
            Under 18 (photos stay private)
          </label>
          <Field label="Notes" htmlFor="e-notes" error={errors.notes} className="sm:col-span-2">
            <Textarea
              id="e-notes"
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Guard sizes, product, what they like to talk about"
            />
          </Field>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
