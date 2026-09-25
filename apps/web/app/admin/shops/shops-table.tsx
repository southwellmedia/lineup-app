"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";

const FILTERS = {
  all: "All shops",
  active: "Booked in 30 days",
  quiet: "No bookings in 30 days",
  suspended: "Suspended",
} as const;
type Filter = keyof typeof FILTERS;

export function ShopsTable() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.admin.shops.queryOptions());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shops = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((s) => {
      if (filter === "active" && s.bookings === 0) return false;
      if (filter === "quiet" && s.bookings > 0) return false;
      if (filter === "suspended" && !s.suspended) return false;
      if (!q) return true;
      return [s.name, s.slug, ...s.owners.flatMap((o) => [o.name, o.email ?? ""])].some((v) =>
        v.toLowerCase().includes(q),
      );
    });
  }, [data, search, filter]);

  return (
    <>
      <PageHeader kicker="Lineup" title="Shops" description={`${data.length} total`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="search"
          aria-label="Search shops"
          placeholder="Search by shop, link or owner"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          aria-label="Filter shops"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="w-auto"
        >
          {Object.entries(FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {shops.length === 0 ? (
        <EmptyState title="No shops match" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Shop</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 text-right font-semibold">Team</th>
                <th className="px-4 py-3 text-right font-semibold">Bookings (30d)</th>
                <th className="px-4 py-3 text-right font-semibold">Texts (30d)</th>
                <th className="px-4 py-3 font-semibold">Last booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shops.map((s) => (
                <tr key={s.id} className="hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/shops/${s.id}` as Route}
                      className="font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
                    >
                      {s.name}
                    </Link>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {s.suspended ? <Badge tone="danger">Suspended</Badge> : null}
                      {s.premiumTemplates ? <Badge tone="muted">Premium</Badge> : null}
                    </span>
                    <p className="text-xs text-muted">
                      /{s.slug} · joined {DateTime.fromISO(s.createdAt).toFormat("LLL d, yyyy")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {s.owners[0] ? (
                      <>
                        <p>{s.owners[0].name}</p>
                        <p className="text-xs text-muted">{s.owners[0].email}</p>
                      </>
                    ) : (
                      <span className="text-muted">No owner</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{s.plan}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.staff}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.bookings}
                    {s.bookedCents ? (
                      <span className="block text-xs text-muted">{formatCents(s.bookedCents)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.textsSent}
                    {s.textsFailed ? (
                      <span className="block text-xs font-semibold text-danger">
                        {s.textsFailed} failed
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {s.lastBookingAt ? DateTime.fromISO(s.lastBookingAt).toRelative() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
