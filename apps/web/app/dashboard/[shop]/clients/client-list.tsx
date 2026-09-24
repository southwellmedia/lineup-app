"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState, type FormEvent } from "react";
import { useShop } from "@/components/shop-context";
import {
  Button,
  Card,
  EmptyState,
  Field,
  fieldErrors,
  Input,
  Notice,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { formatPhone } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";

export function ClientList() {
  const trpc = useTRPC();
  const shop = useShop();
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const { data: clients = [], isFetching } = useQuery(
    trpc.clients.list.queryOptions(
      { shopId: shop.id, search: deferred },
      { placeholderData: keepPreviousData },
    ),
  );
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader
        kicker={shop.name}
        title="Clients"
        description={
          shop.isManager
            ? "Everyone who's booked with the shop."
            : "Clients you've cut or who prefer you."
        }
        action={
          <div className="flex gap-2">
            <a
              href={`/dashboard/${shop.slug}/clients/export`}
              className="inline-flex items-center rounded-full border border-line bg-card px-5 py-2.5 font-semibold hover:border-ink"
            >
              Export CSV
            </a>
            {adding ? null : (
              <Button variant="primary" onClick={() => setAdding(true)}>
                + Add client
              </Button>
            )}
          </div>
        }
      />

      {adding ? <AddClient onClose={() => setAdding(false)} /> : null}

      <div className="mb-4">
        <label htmlFor="client-search" className="sr-only">
          Search clients
        </label>
        <Input
          id="client-search"
          type="search"
          placeholder="Search by name, phone or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-lg"
        />
      </div>

      {clients.length === 0 ? (
        <EmptyState title={deferred ? "No matches" : "No clients yet"}>
          {deferred
            ? "Try part of a name or the last 4 digits of a phone."
            : "Clients appear here when they book."}
        </EmptyState>
      ) : (
        <ul
          className={`divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card transition-opacity ${
            isFetching ? "opacity-70" : ""
          }`}
        >
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/${shop.slug}/clients/${c.id}` as Route}
                className="flex items-center gap-4 p-4 hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-paper font-display text-lg font-extrabold uppercase ring-1 ring-line"
                >
                  {c.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-muted">
                    {c.phone ? formatPhone(c.phone) : "Walk-in, no phone"}
                  </p>
                </div>
                <div className="hidden text-right text-sm sm:block">
                  <p className="font-semibold">
                    {c.visits} {c.visits === 1 ? "visit" : "visits"}
                  </p>
                  <p className="text-muted">
                    {c.nextVisitAt
                      ? `Next ${DateTime.fromISO(c.nextVisitAt, { zone: shop.timezone }).toFormat("LLL d")}`
                      : c.lastVisitAt
                        ? `Last ${DateTime.fromISO(c.lastVisitAt, { zone: shop.timezone }).toRelative()}`
                        : "New"}
                  </p>
                </div>
                <p className="w-20 text-right font-semibold tabular-nums">
                  {formatCents(c.spentCents)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {clients.length >= 300 ? (
        <p className="mt-3 text-sm text-muted">Showing the first 300. Search to narrow it down.</p>
      ) : null}
    </div>
  );
}

function AddClient({ onClose }: { onClose: () => void }) {
  const trpc = useTRPC();
  const shop = useShop();
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useMutation(trpc.clients.create.mutationOptions());
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setError(null);
    try {
      const { id } = await create.mutateAsync({
        shopId: shop.id,
        name: form.name,
        phone: form.phone,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        preferredStaffId: shop.isManager ? null : shop.staffId,
      });
      await queryClient.invalidateQueries({ queryKey: trpc.clients.list.pathKey() });
      router.push(`/dashboard/${shop.slug}/clients/${id}` as Route);
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe);
      else setError((e as Error).message);
    }
  };

  return (
    <Card className="mb-6 animate-rise border-ink shadow-[4px_4px_0_0_var(--color-ink)]">
      <form onSubmit={submit} noValidate className="space-y-4">
        <h2 className="font-display text-3xl font-black uppercase">New client</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="c-name" error={errors.name}>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field
            label="Mobile number"
            htmlFor="c-phone"
            error={errors.phone}
            hint="Needed for reminders. Leave blank for a walk-in who didn't give one."
          >
            <Input
              id="c-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email (optional)" htmlFor="c-email" error={errors.email}>
            <Input
              id="c-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Notes (optional)" htmlFor="c-notes" error={errors.notes}>
            <Textarea
              id="c-notes"
              rows={1}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Usual cut, preferences"
              className="min-h-0"
            />
          </Field>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add client"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
