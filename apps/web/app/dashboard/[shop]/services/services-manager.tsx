"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useState, type FormEvent } from "react";
import { useShop } from "@/components/shop-context";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  fieldErrors,
  Input,
  MoneyInput,
  Notice,
  PageHeader,
  Switch,
  Textarea,
  toCents,
} from "@/components/ui";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";

type Menu = inferRouterOutputs<AppRouter>["services"]["list"];
type Service = Menu["services"][number];

const dollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));

/** "Everyone", "2 of 3 barbers" or "Nobody": counts only barbers who take bookings. */
function offeredLabel(service: Service, barbers: Menu["barbers"]): string {
  const bookable = barbers.filter((b) => b.isBookable);
  const offering = bookable.filter((b) => service.offeredBy.some((o) => o.staffId === b.id)).length;
  if (offering === 0) return "Nobody offers it yet";
  return offering === bookable.length ? "Everyone" : `${offering} of ${bookable.length} barbers`;
}

export function ServicesManager() {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.services.list.queryOptions({ shopId: shop.id }));
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.services.list.pathKey() });
  const move = useMutation(trpc.services.move.mutationOptions({ onSuccess: refresh }));

  const active = data.services.filter((s) => s.isActive);
  const archived = data.services.filter((s) => !s.isActive);
  const groups = [
    { title: "Services", rows: active.filter((s) => !s.isAddon) },
    { title: "Add-ons", rows: active.filter((s) => s.isAddon) },
  ];

  return (
    <div>
      <PageHeader
        kicker={shop.name}
        title="Services"
        description="Your menu. Prices and times here drive the booking page, the calendar and your website."
        action={
          editing ? null : (
            <Button variant="primary" onClick={() => setEditing("new")}>
              + New service
            </Button>
          )
        }
      />

      {editing ? (
        <ServiceEditor
          key={editing === "new" ? "new" : editing.id}
          service={editing === "new" ? null : editing}
          barbers={data.barbers}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      ) : null}

      {data.services.length === 0 && !editing ? (
        <EmptyState title="No services yet">Add your first service so clients can book.</EmptyState>
      ) : null}

      {groups.map((group) =>
        group.rows.length ? (
          <section key={group.title} className="mb-8">
            <h2 className="mb-3 font-display text-2xl font-bold uppercase">{group.title}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {group.rows.map((service, i) => (
                <li key={service.id} className="flex items-center gap-3 p-4">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${service.name} up`}
                      disabled={i === 0 || move.isPending}
                      onClick={() =>
                        move.mutate({ shopId: shop.id, serviceId: service.id, direction: "up" })
                      }
                      className="rounded px-1 text-muted hover:text-ink disabled:opacity-20"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${service.name} down`}
                      disabled={i === group.rows.length - 1 || move.isPending}
                      onClick={() =>
                        move.mutate({ shopId: shop.id, serviceId: service.id, direction: "down" })
                      }
                      className="rounded px-1 text-muted hover:text-ink disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-muted">
                      {service.durationMinutes} min
                      {service.depositCents
                        ? ` · ${formatCents(service.depositCents)} deposit`
                        : ""}{" "}
                      · {offeredLabel(service, data.barbers)}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatCents(service.priceCents)}</p>
                  <Button size="sm" onClick={() => setEditing(service)}>
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {archived.length ? (
        <section>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-sm font-semibold text-muted underline-offset-4 hover:underline"
            aria-expanded={showArchived}
          >
            {showArchived ? "Hide" : "Show"} {archived.length} archived
          </button>
          {showArchived ? (
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-dashed border-line">
              {archived.map((service) => (
                <li key={service.id} className="flex items-center gap-3 p-4 text-muted">
                  <span className="flex-1">{service.name}</span>
                  <Button size="sm" onClick={() => setEditing(service)}>
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ServiceEditor(props: {
  service: Service | null;
  barbers: Menu["barbers"];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const trpc = useTRPC();
  const shop = useShop();
  const s = props.service;
  const save = useMutation(trpc.services.save.mutationOptions());

  const [form, setForm] = useState({
    name: s?.name ?? "",
    description: s?.description ?? "",
    duration: String(s?.durationMinutes ?? 30),
    buffer: String(s?.bufferAfterMinutes ?? 0),
    price: dollars(s?.priceCents ?? null),
    deposit: dollars(s?.depositCents ?? 0),
    isAddon: s?.isAddon ?? false,
    isActive: s?.isActive ?? true,
  });
  // New services are offered by every bookable barber by default.
  const [offers, setOffers] = useState<
    Record<string, { on: boolean; price: string; duration: string }>
  >(() =>
    Object.fromEntries(
      props.barbers.map((b) => {
        const offer = s?.offeredBy.find((o) => o.staffId === b.id);
        return [
          b.id,
          {
            on: s ? Boolean(offer) : b.isBookable,
            price: dollars(offer?.priceCents ?? null),
            duration: offer?.durationMinutes ? String(offer.durationMinutes) : "",
          },
        ];
      }),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    const price = toCents(form.price);
    const deposit = toCents(form.deposit);
    const local: Record<string, string> = {};
    if (price === null) local.priceCents = "Enter a price like 35 or 35.00";
    if (deposit === null) local.depositCents = "Enter an amount like 10";
    const offeredBy = [];
    for (const b of props.barbers) {
      const o = offers[b.id];
      if (!o?.on) continue;
      const own = o.price ? toCents(o.price) : null;
      if (o.price && own === null) local[`offer-${b.id}`] = "Invalid price";
      offeredBy.push({
        staffId: b.id,
        priceCents: own,
        durationMinutes: o.duration ? Number(o.duration) : null,
      });
    }
    if (Object.keys(local).length) return setErrors(local);

    try {
      await save.mutateAsync({
        shopId: shop.id,
        ...(s ? { id: s.id } : {}),
        name: form.name,
        description: form.description.trim() || null,
        durationMinutes: Number(form.duration),
        bufferAfterMinutes: Number(form.buffer || 0),
        priceCents: price ?? 0,
        depositCents: deposit ?? 0,
        isAddon: form.isAddon,
        isActive: form.isActive,
        offeredBy,
      });
      await props.onSaved();
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe);
      else setFormError((e as Error).message);
    }
  };

  return (
    <Card className="mb-8 animate-rise border-ink shadow-[4px_4px_0_0_var(--color-ink)]">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-3xl font-black uppercase">
            {s ? `Edit ${s.name}` : "New service"}
          </h2>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="svc-name" error={errors.name} className="sm:col-span-2">
            <Input
              id="svc-name"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Description (optional)"
            htmlFor="svc-desc"
            error={errors.description}
            className="sm:col-span-2"
          >
            <Textarea
              id="svc-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What's included"
            />
          </Field>
          <Field label="Price" htmlFor="svc-price" error={errors.priceCents}>
            <MoneyInput
              id="svc-price"
              value={form.price}
              onChange={(e) => set("price")(e.target.value)}
            />
          </Field>
          <Field label="Duration (minutes)" htmlFor="svc-duration" error={errors.durationMinutes}>
            <Input
              id="svc-duration"
              type="number"
              min={5}
              step={5}
              value={form.duration}
              onChange={(e) => set("duration")(e.target.value)}
            />
          </Field>
          <Field
            label="Deposit"
            htmlFor="svc-deposit"
            error={errors.depositCents}
            hint="Taken at booking once card payments are on. 0 for none."
          >
            <MoneyInput
              id="svc-deposit"
              value={form.deposit}
              onChange={(e) => set("deposit")(e.target.value)}
            />
          </Field>
          <Field
            label="Cleanup after (minutes)"
            htmlFor="svc-buffer"
            error={errors.bufferAfterMinutes}
            hint="Blocks the calendar; clients don't see it."
          >
            <Input
              id="svc-buffer"
              type="number"
              min={0}
              step={5}
              value={form.buffer}
              onChange={(e) => set("buffer")(e.target.value)}
            />
          </Field>
        </div>

        <div className="space-y-4 rounded-xl bg-paper p-4">
          <Switch
            id="svc-addon"
            checked={form.isAddon}
            onChange={set("isAddon")}
            label="Add-on"
            description="Booked alongside a main service, like a beard trim or design."
          />
          <Switch
            id="svc-active"
            checked={form.isActive}
            onChange={set("isActive")}
            label="Bookable"
            description="Turn off to archive it. Past appointments keep their history."
          />
        </div>

        <fieldset>
          <legend className="mb-2 font-semibold">Who offers it</legend>
          <p className="mb-3 text-sm text-muted">
            Leave a barber&apos;s price or time blank to use the defaults above.
          </p>
          <ul className="space-y-2">
            {props.barbers.map((b) => {
              const o = offers[b.id] ?? { on: false, price: "", duration: "" };
              const update = (patch: Partial<typeof o>) =>
                setOffers((all) => ({ ...all, [b.id]: { ...o, ...patch } }));
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
                >
                  <label className="flex min-w-32 flex-1 cursor-pointer items-center gap-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={o.on}
                      onChange={(e) => update({ on: e.target.checked })}
                      className="size-5 accent-[var(--color-ink)]"
                    />
                    {b.name}
                    {!b.isBookable ? <Badge tone="muted">Not bookable</Badge> : null}
                  </label>
                  {o.on ? (
                    <>
                      <MoneyInput
                        aria-label={`${b.name}'s price`}
                        placeholder={form.price || "Default"}
                        value={o.price}
                        onChange={(e) => update({ price: e.target.value })}
                        className="w-32"
                      />
                      <Input
                        aria-label={`${b.name}'s minutes`}
                        type="number"
                        min={5}
                        step={5}
                        placeholder={`${form.duration} min`}
                        value={o.duration}
                        onChange={(e) => update({ duration: e.target.value })}
                        width="w-28"
                      />
                    </>
                  ) : null}
                  {errors[`offer-${b.id}`] ? (
                    <p className="w-full text-sm text-danger">{errors[`offer-${b.id}`]}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>

        {formError ? <Notice tone="error">{formError}</Notice> : null}

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : s ? "Save changes" : "Add service"}
          </Button>
          <Button onClick={props.onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
