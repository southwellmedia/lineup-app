"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useShop } from "@/components/shop-context";
import {
  Badge,
  Button,
  Card,
  Field,
  fieldErrors,
  Input,
  Notice,
  PageHeader,
  Select,
} from "@/components/ui";
import { useTRPC } from "@/trpc/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROLE_LABEL = { owner: "Owner", manager: "Manager", barber: "Barber" } as const;

export function TeamList() {
  const trpc = useTRPC();
  const shop = useShop();
  const { data: team } = useSuspenseQuery(trpc.team.list.queryOptions({ shopId: shop.id }));
  const [inviting, setInviting] = useState(false);

  return (
    <div>
      <PageHeader
        kicker={shop.name}
        title="Team"
        description="Everyone who works here. Invite barbers by email; they sign in with it to get access."
        action={
          inviting ? null : (
            <Button variant="primary" onClick={() => setInviting(true)}>
              + Invite
            </Button>
          )
        }
      />

      {inviting ? <InviteForm onDone={() => setInviting(false)} /> : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {team.map((m) => (
          <li key={m.id}>
            <Link
              href={`/dashboard/${shop.slug}/team/${m.id}` as Route}
              className={`block rounded-2xl border border-line bg-card p-4 transition-[border-color,box-shadow] hover:border-ink hover:shadow-[4px_4px_0_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                m.isActive ? "" : "opacity-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-paper font-display text-xl font-extrabold uppercase ring-1 ring-line"
                >
                  {m.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {m.name}
                    <Badge tone={m.role === "barber" ? "neutral" : "ink"}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                    {m.pending ? (
                      <Badge tone={m.email ? "brand" : "muted"}>
                        {m.email ? "Invited" : "No login"}
                      </Badge>
                    ) : null}
                    {!m.isActive ? <Badge tone="muted">Inactive</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-muted">{m.email ?? "No email"}</p>
                  <p className="mt-2 flex gap-1" aria-label="Days worked">
                    {DAYS.map((d, i) => (
                      <span
                        key={d}
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                          m.daysWorked.includes(i) ? "bg-ink text-paper" : "bg-paper text-muted"
                        }`}
                      >
                        {d}
                      </span>
                    ))}
                  </p>
                  {!m.isBookable && m.isActive ? (
                    <p className="mt-1 text-xs text-muted">Not taking bookings</p>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const invite = useMutation(trpc.team.invite.mutationOptions());
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "barber" as "barber" | "manager" | "owner",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setError(null);
    try {
      await invite.mutateAsync({ shopId: shop.id, ...form });
      await queryClient.invalidateQueries({ queryKey: trpc.team.list.pathKey() });
      onDone();
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe);
      else setError((e as Error).message);
    }
  };

  return (
    <Card className="mb-6 animate-rise border-ink shadow-[4px_4px_0_0_var(--color-ink)]">
      <form onSubmit={submit} noValidate className="space-y-4">
        <h2 className="font-display text-3xl font-black uppercase">Invite to the team</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" htmlFor="inv-name" error={errors.name}>
            <Input
              id="inv-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Email" htmlFor="inv-email" error={errors.email}>
            <Input
              id="inv-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Role" htmlFor="inv-role">
            <Select
              id="inv-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
            >
              <option value="barber">Barber</option>
              <option value="manager">Manager</option>
              {shop.role === "owner" ? <option value="owner">Owner</option> : null}
            </Select>
          </Field>
        </div>
        <p className="text-sm text-muted">
          They&apos;ll get access the first time they sign in at{" "}
          <span className="font-medium text-ink">/login</span> with this email. Set their hours next
          so clients can book them.
        </p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={invite.isPending}>
            {invite.isPending ? "Adding…" : "Add to team"}
          </Button>
          <Button onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
