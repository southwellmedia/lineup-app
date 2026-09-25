"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Field,
  Notice,
  Select,
  Switch,
  Textarea,
  StatCard,
} from "@/components/ui";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import { describeAudit } from "@/lib/admin/describe";

const ROLE: Record<string, string> = { owner: "Owner", manager: "Manager", barber: "Barber" };
const TEXT_KIND: Record<string, string> = {
  confirmation: "Confirmation",
  reminder_24h: "Day-before reminder",
  reminder_2h: "2-hour reminder",
  reply: "Reply",
  inbound: "Inbound",
};

export function ShopDetail({ shopId }: { shopId: string }) {
  const trpc = useTRPC();
  const { data: shop } = useSuspenseQuery(trpc.admin.shop.queryOptions({ shopId }));
  const when = (iso: string) => DateTime.fromISO(iso).toFormat("LLL d, yyyy 'at' h:mm a");

  return (
    <>
      <Link
        href={"/admin/shops" as Route}
        className="text-sm font-semibold text-muted hover:text-ink"
      >
        ← Shops
      </Link>
      <header className="mb-6 mt-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight">
            {shop.name}
            {shop.suspendedAt ? <Badge tone="danger">Suspended</Badge> : null}
          </h1>
          <p className="mt-2 text-muted">
            <span className="capitalize">{shop.plan}</span> plan · {shop.timezone} · joined{" "}
            {DateTime.fromISO(shop.createdAt).toFormat("LLL d, yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <a
            href={shop.bookingPath}
            target="_blank"
            rel="noreferrer"
            className="rounded-full px-3 py-1.5 ring-1 ring-line hover:ring-ink"
          >
            Booking page ↗
          </a>
          {shop.siteUrl ? (
            <a
              href={shop.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-1.5 ring-1 ring-line hover:ring-ink"
            >
              Website ↗
            </a>
          ) : null}
        </div>
      </header>

      {shop.suspendedAt ? (
        <div className="mb-5">
          <Notice tone="error">
            Suspended {when(shop.suspendedAt)}
            {shop.suspendedReason ? `: ${shop.suspendedReason}` : ""}. The booking page, website and
            texts are off; the team can still sign in.
          </Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookings (30d)" value={shop.stats.bookings}>
          {formatCents(shop.stats.bookedCents)} booked
        </Stat>
        <Stat label="Clients" value={shop.stats.clients}>
          {shop.stats.lastBookingAt
            ? `Last booking ${DateTime.fromISO(shop.stats.lastBookingAt).toRelative()}`
            : "No bookings yet"}
        </Stat>
        <Stat label="Texts (30d)" value={shop.stats.textsSent}>
          {shop.smsEnabled ? "Texts on" : "Texts off"}
          {shop.stats.textsFailed ? ` · ${shop.stats.textsFailed} failed` : ""}
        </Stat>
        <Stat label="Site views (30d)" value={shop.stats.siteViews}>
          {shop.template.name}
          {shop.template.tier === "premium" ? " (premium)" : ""}
        </Stat>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card>
            <CardTitle
              action={<span className="text-sm text-muted">{shop.services} services</span>}
            >
              Team
            </CardTitle>
            <ul className="divide-y divide-line">
              {shop.team.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {m.name}{" "}
                      <span className="text-sm font-normal text-muted">
                        {ROLE[m.role] ?? m.role}
                      </span>
                    </p>
                    <p className="truncate text-sm text-muted">{m.email ?? "No email"}</p>
                  </div>
                  <span className="flex gap-1">
                    {!m.active ? <Badge tone="muted">Inactive</Badge> : null}
                    {m.signedUp ? (
                      <Badge>Signed in</Badge>
                    ) : m.email ? (
                      <Badge tone="muted">Invited</Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {shop.failedTexts.length ? (
            <Card>
              <CardTitle>Failed texts</CardTitle>
              <ul className="divide-y divide-line text-sm">
                {shop.failedTexts.map((t) => (
                  <li key={t.id} className="py-2">
                    <p className="font-semibold">
                      {TEXT_KIND[t.kind] ?? t.kind}{" "}
                      <span className="font-normal text-muted">{when(t.at)}</span>
                    </p>
                    <p className="text-danger">{t.error ?? "Unknown error"}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardTitle>History</CardTitle>
            {shop.audit.length ? (
              <ul className="divide-y divide-line text-sm">
                {shop.audit.map((e) => (
                  <li key={e.id} className="py-2">
                    <p>{describeAudit(e.action, e.detail)}</p>
                    <p className="text-xs text-muted">
                      {e.by} · {when(e.at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No admin changes yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <PlanCard
            key={`${shop.plan}-${shop.premiumTemplates}`}
            shopId={shop.id}
            plan={shop.plan}
            premiumTemplates={shop.premiumTemplates}
          />
          <SuspendCard shopId={shop.id} suspended={shop.suspendedAt !== null} name={shop.name} />
        </div>
      </div>
    </>
  );
}

function useRefresh() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: trpc.admin.shop.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.admin.shops.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.admin.overview.pathKey() }),
      queryClient.invalidateQueries({ queryKey: trpc.admin.audit.pathKey() }),
    ]);
}

function PlanCard(props: { shopId: string; plan: "solo" | "shop"; premiumTemplates: boolean }) {
  const trpc = useTRPC();
  const refresh = useRefresh();
  const [plan, setPlan] = useState(props.plan);
  const [premium, setPremium] = useState(props.premiumTemplates);
  const save = useMutation(trpc.admin.updateShop.mutationOptions({ onSuccess: refresh }));
  const dirty = plan !== props.plan || premium !== props.premiumTemplates;

  return (
    <Card>
      <CardTitle>Plan</CardTitle>
      <div className="space-y-4">
        <Field label="Plan" htmlFor="a-plan">
          <Select
            id="a-plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value as "solo" | "shop")}
          >
            <option value="solo">Solo (one barber)</option>
            <option value="shop">Shop (a team)</option>
          </Select>
        </Field>
        <Switch
          id="a-premium"
          checked={premium}
          onChange={setPremium}
          label="Premium templates"
          description="Lets the shop publish premium website templates like Contact Sheet."
        />
        {save.error ? <Notice tone="error">{save.error.message}</Notice> : null}
        <Button
          variant="primary"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ shopId: props.shopId, plan, premiumTemplates: premium })}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

function SuspendCard(props: { shopId: string; suspended: boolean; name: string }) {
  const trpc = useTRPC();
  const refresh = useRefresh();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const suspend = useMutation(
    trpc.admin.suspend.mutationOptions({
      onSuccess: async () => {
        setReason("");
        setConfirming(false);
        await refresh();
      },
    }),
  );
  const unsuspend = useMutation(trpc.admin.unsuspend.mutationOptions({ onSuccess: refresh }));
  const error = suspend.error ?? unsuspend.error;

  if (props.suspended) {
    return (
      <Card>
        <CardTitle>Suspension</CardTitle>
        <p className="mb-4 text-sm text-muted">
          Lifting it brings the booking page, website and texts back right away.
        </p>
        {error ? <Notice tone="error">{error.message}</Notice> : null}
        <Button
          variant="primary"
          disabled={unsuspend.isPending}
          onClick={() => unsuspend.mutate({ shopId: props.shopId })}
        >
          {unsuspend.isPending ? "Lifting…" : "Lift suspension"}
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Suspend</CardTitle>
      <p className="mb-4 text-sm text-muted">
        Takes the booking page and website offline and stops texts. Nothing is deleted, and the team
        can still sign in and see their bookings.
      </p>
      <Field label="Reason (kept in the audit log)" htmlFor="a-reason">
        <Textarea
          id="a-reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setConfirming(false);
          }}
          placeholder="e.g. Unpaid invoice, abuse report #123"
        />
      </Field>
      <div className="mt-4 space-y-3">
        {error ? <Notice tone="error">{error.message}</Notice> : null}
        {confirming ? (
          <Warning>
            Suspend <strong>{props.name}</strong>? Clients won&apos;t be able to book until you lift
            it.
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                disabled={suspend.isPending}
                onClick={() => suspend.mutate({ shopId: props.shopId, reason })}
              >
                {suspend.isPending ? "Suspending…" : "Yes, suspend"}
              </Button>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          </Warning>
        ) : (
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            onClick={() => setConfirming(true)}
          >
            Suspend shop
          </Button>
        )}
      </div>
    </Card>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{children}</div>;
}

function Stat(props: { label: string; value: string | number; children: ReactNode }) {
  return <StatCard label={props.label} value={props.value} hint={props.children} />;
}
