"use client";

import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { Card, CardTitle, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { sourceLabel } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";

export function Overview() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.admin.overview.queryOptions());
  const maxSource = Math.max(1, ...data.sources.map((s) => s.bookings));
  const maxSignups = Math.max(1, ...data.signups.map((w) => w.shops));

  return (
    <>
      <PageHeader
        kicker="Lineup"
        title="Overview"
        description="The last 30 days across every shop."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Shops" value={data.shops}>
          {data.solo} solo · {data.shops - data.solo} shop
          {data.suspended ? ` · ${data.suspended} suspended` : ""}
        </Stat>
        <Stat label="Active shops" value={data.activeShops}>
          Took a booking in 30 days
        </Stat>
        <Stat label="Bookings" value={data.bookings.toLocaleString()}>
          {formatCents(data.bookedCents)} booked
        </Stat>
        <Stat label="Texts sent" value={data.textsSent.toLocaleString()}>
          {data.twilioReady
            ? data.textsFailed
              ? `${data.textsFailed} failed`
              : "No failures"
            : "Twilio not connected"}
        </Stat>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Where bookings come from</CardTitle>
          {data.sources.length ? (
            <ul className="space-y-2.5">
              {data.sources.map((s) => (
                <li key={s.source}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{sourceLabel(s.source)}</span>
                    <span className="tabular-nums text-muted">{s.bookings}</span>
                  </div>
                  <div className="h-2 rounded-full bg-paper">
                    <div
                      className="h-2 rounded-full bg-ink"
                      style={{ width: `${(s.bookings / maxSource) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No bookings yet" />
          )}
        </Card>

        <Card>
          <CardTitle>New shops by week</CardTitle>
          <div className="flex h-36 items-end gap-2" role="img" aria-label="New shops per week">
            {data.signups.map((w) => (
              <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs tabular-nums text-muted">{w.shops || ""}</span>
                <div
                  className="w-full rounded-t-md bg-ink"
                  style={{ height: `${Math.max(2, (w.shops / maxSignups) * 100)}px` }}
                />
                <span className="text-[10px] text-muted">
                  {DateTime.fromISO(w.week).toFormat("LLL d")}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold">Newest</p>
          <ul className="mt-1 divide-y divide-line text-sm">
            {data.newest.map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2">
                <Link
                  href={`/admin/shops/${s.id}` as Route}
                  className="font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  {s.name}
                </Link>
                <span className="text-muted">{DateTime.fromISO(s.createdAt).toRelative()}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-5 text-sm text-muted">
        {data.siteViews.toLocaleString()} website page views in 30 days.
      </p>
    </>
  );
}

function Stat(props: { label: string; value: string | number; children: ReactNode }) {
  return <StatCard label={props.label} value={props.value} hint={props.children} />;
}
