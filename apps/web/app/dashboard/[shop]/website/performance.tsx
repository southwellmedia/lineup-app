"use client";

import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui";
import { useShop } from "@/components/shop-context";
import { rate } from "@/lib/analytics/report";
import { sourceLabel } from "@/lib/dashboard/summary";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import { Skeleton, StatRowSkeleton } from "@/components/skeleton";

type Days = 7 | 30 | 90;

const CHANNEL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  tiktok: "TikTok",
  x: "X (Twitter)",
  yelp: "Yelp",
  bing: "Bing",
};

/** "/" → "Home", "/services/fade" → "Service: fade". */
function pageLabel(path: string): string {
  if (path === "/") return "Home";
  const [, section, slug] = path.split("/");
  if (section === "services" && slug) return `Service: ${slug.replace(/-/g, " ")}`;
  if (section === "barbers" && slug) return `Barber: ${slug.replace(/-/g, " ")}`;
  return path;
}

export function Performance() {
  const trpc = useTRPC();
  const shop = useShop();
  const [days, setDays] = useState<Days>(30);
  const { data, isFetching } = useQuery(
    trpc.website.analytics.queryOptions(
      { shopId: shop.id, days },
      { placeholderData: (previous) => previous },
    ),
  );

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[1.0625rem] font-semibold tracking-tight">Performance</h2>
          <p className="text-sm text-muted">
            Cookie-free: visitors are counted anonymously, once a day.
          </p>
        </div>
        <div
          role="group"
          aria-label="Date range"
          className="flex rounded-full bg-paper p-1 ring-1 ring-line"
        >
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className="rounded-full px-3 py-1 text-sm font-semibold text-muted aria-pressed:bg-ink aria-pressed:text-paper"
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div role="status" aria-busy="true" className="space-y-6 p-5">
          <span className="sr-only">Loading…</span>
          <StatRowSkeleton count={4} dark={2} />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : (
        <div className={`space-y-6 p-5 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Visitors"
              value={data.visitors.toLocaleString()}
              note={`${data.pageviews.toLocaleString()} page views`}
            />
            <Stat
              label="Clicked Book"
              value={data.bookClicks.toLocaleString()}
              note={pct(rate(data.bookClicks, data.visitors), "of visitors")}
            />
            <Stat
              label="Bookings from site"
              value={data.bookings.toLocaleString()}
              note={pct(rate(data.bookings, data.visitors), "of visitors")}
              highlight
            />
            <Stat
              label="Booked value"
              value={formatCents(data.bookedValueCents)}
              note="From website bookings"
            />
          </dl>

          <Chart points={data.daily} />

          <Funnel
            steps={[
              ["Visited your site", data.visitors],
              ["Clicked Book", data.bookClicks],
              ["Opened booking page", data.bookingPageVisits],
              ["Booked", data.bookings],
            ]}
          />

          <div className="grid gap-5 md:grid-cols-3">
            <BarList
              title="Top pages"
              empty="No page views yet."
              rows={data.pages.map((p) => ({
                key: p.path,
                label: pageLabel(p.path),
                value: p.pageviews,
              }))}
            />
            <BarList
              title="Where visitors come from"
              empty="No visitors yet."
              rows={data.referrers.map((r) => ({
                key: r.referrer ?? "direct",
                label: r.referrer
                  ? (CHANNEL_LABEL[r.referrer] ?? r.referrer)
                  : "Direct or typed in",
                value: r.visitors,
              }))}
            />
            <BarList
              title="Bookings by source"
              empty="No bookings yet."
              highlight="website"
              rows={data.sources.map((s) => ({
                key: s.source,
                label: sourceLabel(s.source),
                value: s.count,
              }))}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function pct(value: number | null, suffix: string): string | undefined {
  return value === null ? undefined : `${value}% ${suffix}`;
}

function Stat(props: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 ${props.highlight ? "bg-ink text-paper" : "bg-paper ring-1 ring-line"}`}
    >
      <dt className={`text-sm font-semibold ${props.highlight ? "text-paper/70" : "text-muted"}`}>
        {props.label}
      </dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{props.value}</dd>
      {props.note ? (
        <dd className={`text-sm ${props.highlight ? "text-paper/70" : "text-muted"}`}>
          {props.note}
        </dd>
      ) : null}
    </div>
  );
}

function Chart({
  points,
}: {
  points: { day: string; visitors: number; bookClicks: number; bookings: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.visitors));
  const total = points.reduce((s, p) => s + p.visitors, 0);
  const label = (day: string) => DateTime.fromISO(day).toFormat("LLL d");
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure>
      <figcaption className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">Visitors per day</span>
        <span className="flex items-center gap-3 text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm bg-ink/80" /> Visitors
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-brand" /> Booked
          </span>
        </span>
      </figcaption>
      <div
        role="img"
        aria-label={`${total} visitors over ${points.length} days`}
        className="relative flex h-40 items-end gap-px rounded-xl bg-paper px-2 pb-2 pt-4 ring-1 ring-line sm:gap-1"
      >
        {total === 0 ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">
            No visits yet. Share your site link and visits show up here within a minute.
          </p>
        ) : null}
        {points.map((p) => (
          <div
            key={p.day}
            title={`${label(p.day)}: ${p.visitors} visitors, ${p.bookClicks} Book clicks, ${p.bookings} booked`}
            className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <div
              className="w-full rounded-t-sm bg-ink/80"
              style={{ height: `${(p.visitors / max) * 100}%`, minHeight: p.visitors ? 2 : 0 }}
            />
            {p.bookings ? (
              <span
                aria-hidden
                className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-brand ring-2 ring-paper"
                style={{ bottom: `calc(${(p.visitors / max) * 100}% + 4px)` }}
              />
            ) : null}
          </div>
        ))}
      </div>
      {first && last ? (
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{label(first.day)}</span>
          <span>{label(last.day)}</span>
        </div>
      ) : null}
    </figure>
  );
}

function Funnel({ steps }: { steps: [string, number][] }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {steps.map(([label, value], i) => {
        const previous = i > 0 ? steps[i - 1]?.[1] : undefined;
        const share = previous === undefined ? null : rate(value, previous);
        return (
          <li key={label} className="relative rounded-2xl bg-paper px-4 py-3 ring-1 ring-line">
            <p className="text-sm text-muted">
              <span className="mr-1.5 font-semibold text-ink">{i + 1}</span>
              {label}
            </p>
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {value.toLocaleString()}
            </p>
            {share !== null ? (
              <p className="text-xs font-semibold text-muted">{share}% of the step before</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function BarList(props: {
  title: string;
  empty: string;
  rows: { key: string; label: string; value: number }[];
  highlight?: string;
}) {
  const max = Math.max(1, ...props.rows.map((r) => r.value));
  return (
    <section>
      <CardTitle>{props.title}</CardTitle>
      {props.rows.length === 0 ? (
        <p className="text-sm text-muted">{props.empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {props.rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{r.label}</span>
                <span className="tabular-nums text-muted">{r.value.toLocaleString()}</span>
              </div>
              <div aria-hidden className="h-2 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${r.key === props.highlight ? "bg-brand" : "bg-ink"}`}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
