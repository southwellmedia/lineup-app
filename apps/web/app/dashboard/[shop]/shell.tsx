"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useShop } from "@/components/shop-context";

type Item = { href: string; label: string; icon: ReactNode; exact?: boolean };

const icon = (d: string) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  today: icon(
    "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  ),
  calendar: icon(
    "M3 10h18M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM8 14h2M14 14h2M8 18h2",
  ),
  clients: icon(
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  ),
  services: icon(
    "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12",
  ),
  team: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"),
  website: icon(
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z",
  ),
  settings: icon(
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.17-2.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9h.1a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
  ),
};

export function Shell(props: {
  email: string;
  shops: { slug: string; name: string }[];
  children: ReactNode;
}) {
  const shop = useShop();
  const pathname = usePathname();
  const base = `/dashboard/${shop.slug}`;

  const items: Item[] = [
    { href: base, label: "Today", icon: ICONS.today, exact: true },
    { href: `${base}/calendar`, label: "Calendar", icon: ICONS.calendar },
    { href: `${base}/clients`, label: "Clients", icon: ICONS.clients },
    ...(shop.isManager
      ? [
          { href: `${base}/services`, label: "Services", icon: ICONS.services },
          { href: `${base}/team`, label: "Team", icon: ICONS.team },
          { href: `${base}/website`, label: "Website", icon: ICONS.website },
          { href: `${base}/settings`, label: "Settings", icon: ICONS.settings },
        ]
      : [{ href: `${base}/team/${shop.staffId}`, label: "My hours", icon: ICONS.team }]),
  ];
  const active = (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden bg-ink text-paper md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <span
            aria-hidden
            className="pole h-7 w-2 animate-pole rounded-full ring-1 ring-paper/40"
          />
          <span className="font-display text-3xl font-black uppercase tracking-tight">Lineup</span>
        </div>
        <ShopSwitcher shops={props.shops} className="mx-3 mt-6" />
        <nav aria-label="Dashboard" className="mt-4 flex-1 space-y-1 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={active(item) ? "page" : undefined}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-paper/70 transition-colors hover:bg-paper/10 hover:text-paper aria-[current=page]:bg-paper aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-brand"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-paper/15 p-4 text-sm">
          <p className="truncate text-paper/60">{props.email}</p>
          <SignOut className="mt-2 text-paper/80 hover:text-paper" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-paper md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="pole h-6 w-2 shrink-0 animate-pole rounded-full ring-1 ring-paper/40"
          />
          <ShopSwitcher shops={props.shops} compact />
        </div>
        <SignOut className="shrink-0 rounded-full border border-paper/30 px-3 py-1 text-sm hover:bg-paper hover:text-ink" />
      </header>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-10">
        <div className="mx-auto max-w-4xl">{props.children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active(item) ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-muted aria-[current=page]:text-ink"
          >
            <span className="grid h-7 w-12 place-items-center rounded-full [[aria-current=page]_&]:bg-ink [[aria-current=page]_&]:text-paper">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ShopSwitcher({
  shops,
  className = "",
  compact = false,
}: {
  shops: { slug: string; name: string }[];
  className?: string;
  compact?: boolean;
}) {
  const shop = useShop();
  if (shops.length < 2) {
    return (
      <p
        className={`truncate font-semibold ${compact ? "" : "rounded-xl bg-paper/10 px-3 py-2"} ${className}`}
      >
        {shop.name}
      </p>
    );
  }
  return (
    <details className={`group relative ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 truncate rounded-xl bg-paper/10 px-3 py-2 font-semibold">
        <span className="truncate">{shop.name}</span>
        <span aria-hidden className="text-xs">
          ▾
        </span>
      </summary>
      <ul className="absolute z-30 mt-1 w-56 rounded-xl border border-line bg-card p-1 text-ink shadow-lg">
        {shops.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/dashboard/${s.slug}` as Route}
              className="block rounded-lg px-3 py-2 hover:bg-paper aria-[current=true]:font-semibold"
              aria-current={s.slug === shop.slug}
            >
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function SignOut({ className }: { className: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={`font-medium focus-visible:outline-2 focus-visible:outline-brand ${className}`}
      >
        Sign out
      </button>
    </form>
  );
}
