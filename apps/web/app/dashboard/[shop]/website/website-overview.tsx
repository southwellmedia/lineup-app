"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { useShop } from "@/components/shop-context";
import { useTRPC } from "@/trpc/client";

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  booking_link: "Booking link",
  instagram: "Instagram",
  google: "Google",
  phone: "Phone",
  walk_in: "Walk-in",
  referral: "Referral",
  import: "Imported",
  other: "Other",
};

const SECTION_HREF = {
  settings: "settings#contact",
  team: "team",
  services: "services",
} as const;

export function WebsiteOverview() {
  const trpc = useTRPC();
  const shop = useShop();
  const { data } = useSuspenseQuery(trpc.website.overview.queryOptions({ shopId: shop.id }));
  const base = `/dashboard/${shop.slug}`;

  const done = data.checklist.filter((i) => i.done).length;
  const total = data.checklist.length;
  const booked = data.sources.reduce((sum, s) => sum + s.count, 0);
  const fromSite = data.sources.find((s) => s.source === "website")?.count ?? 0;

  return (
    <>
      <PageHeader
        kicker="Website"
        title="Your site"
        description="A fast, search-friendly site built from your menu, team and hours. It updates on its own when you change them here."
        action={
          data.url ? (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-5 py-2.5 font-semibold text-paper hover:border-brand hover:bg-brand hover:text-brand-ink"
            >
              Open site <span aria-hidden>↗</span>
            </a>
          ) : null
        }
      />

      {data.url ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Preview url={data.url} />
          <div className="space-y-5">
            <AddressCard url={data.url} customDomain={data.customDomain} />

            <Card>
              <CardTitle
                action={
                  <span className="text-sm font-semibold tabular-nums text-muted">
                    {done} of {total}
                  </span>
                }
              >
                Checklist
              </CardTitle>
              <div aria-hidden className="mb-4 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${(done / total) * 100}%` }}
                />
              </div>
              <p className="mb-3 text-sm text-muted">
                Shop details live in Settings, bios in Team, descriptions in Services.
              </p>
              <ul className="divide-y divide-line">
                {data.checklist.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-2.5">
                    <span
                      aria-hidden
                      className={
                        item.done
                          ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-xs text-paper"
                          : "mt-0.5 size-5 shrink-0 rounded-full border-2 border-dashed border-line"
                      }
                    >
                      {item.done ? "✓" : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={item.done ? "text-muted" : "font-semibold"}>
                        {item.label}
                        <span className="sr-only">{item.done ? " (done)" : " (to do)"}</span>
                      </span>
                      {!item.done && item.detail ? (
                        <span className="block text-sm text-muted">{item.detail}</span>
                      ) : null}
                    </span>
                    <Link
                      href={`${base}/${SECTION_HREF[item.section]}` as Route}
                      aria-label={`${item.done ? "Edit" : "Add"} ${item.label.toLowerCase()}`}
                      className={
                        item.done
                          ? "shrink-0 text-sm font-semibold text-muted underline decoration-line underline-offset-4 hover:text-ink hover:decoration-ink"
                          : "shrink-0 text-sm font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
                      }
                    >
                      {item.done ? "Edit" : "Add"}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>Where bookings come from</CardTitle>
              {booked === 0 ? (
                <p className="text-muted">
                  No bookings in the last {data.sourceWindowDays} days yet.
                </p>
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted">
                    Last {data.sourceWindowDays} days ·{" "}
                    <span className="font-semibold text-ink">{fromSite}</span> from your website
                  </p>
                  <ul className="space-y-3">
                    {data.sources.map((s) => (
                      <li key={s.source}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-semibold">
                            {SOURCE_LABELS[s.source] ?? s.source}
                          </span>
                          <span className="tabular-nums text-muted">{s.count}</span>
                        </div>
                        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-line">
                          <div
                            className={s.source === "website" ? "h-full bg-brand" : "h-full bg-ink"}
                            style={{ width: `${(s.count / booked) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <EmptyState title="Websites aren't set up yet">
          Set <code>SITES_URL</code> on the web app to the shop websites address.
        </EmptyState>
      )}
    </>
  );
}

function AddressCard({ url, customDomain }: { url: string; customDomain: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <CardTitle>Address</CardTitle>
      <p className="break-all rounded-xl bg-paper px-3.5 py-2.5 font-mono text-sm ring-1 ring-line">
        {url.replace(/^https?:\/\//, "")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted">
        {customDomain
          ? "Served on your own domain."
          : "Your own domain (like southsidecuts.com) is coming soon."}{" "}
        Every “Book” button on the site opens your booking page, and those bookings are tagged
        Website.
      </p>
    </Card>
  );
}

const DESKTOP_WIDTH = 1280;
const PREVIEW_HEIGHT = 704; // px, both modes

function Preview({ url }: { url: string }) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // The desktop preview renders at a real desktop width, scaled to fit the card.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      // Hidden (phone mode, small screens) measures 0; keep the last scale.
      const width = entry?.contentRect.width ?? 0;
      if (width > 0) setScale(Math.min(1, width / DESKTOP_WIDTH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Card className="flex flex-col p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight">Preview</h2>
        <div
          role="group"
          aria-label="Preview size"
          className="hidden rounded-full bg-paper p-1 ring-1 ring-line sm:flex"
        >
          {(["desktop", "phone"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className="rounded-full px-3 py-1 text-sm font-semibold capitalize text-muted aria-pressed:bg-ink aria-pressed:text-paper"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-b-2xl bg-paper p-4">
        <div ref={frame} className={device === "desktop" ? "hidden sm:block" : "hidden"}>
          <div
            className="overflow-hidden rounded-xl border border-line bg-card"
            style={{ height: PREVIEW_HEIGHT }}
          >
            <iframe
              src={url}
              title="Your website on a computer"
              loading="lazy"
              tabIndex={device === "desktop" ? 0 : -1}
              className="origin-top-left"
              style={{
                width: DESKTOP_WIDTH,
                height: PREVIEW_HEIGHT / scale,
                transform: `scale(${scale})`,
              }}
            />
          </div>
        </div>
        <div
          className={device === "phone" ? "flex justify-center" : "flex justify-center sm:hidden"}
        >
          <iframe
            src={url}
            title="Your website on a phone"
            loading="lazy"
            className="w-[390px] max-w-full rounded-2xl border-2 border-ink bg-card sm:rounded-[2rem] sm:border-8"
            style={{ height: PREVIEW_HEIGHT }}
          />
        </div>
      </div>
    </Card>
  );
}
