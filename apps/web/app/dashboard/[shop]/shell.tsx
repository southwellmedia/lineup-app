"use client";

import {
  Armchair,
  CalendarDays,
  ChartColumn,
  ChevronsUpDown,
  CreditCard,
  Ellipsis,
  Globe,
  House,
  LoaderCircle,
  ListOrdered,
  LogOut,
  Megaphone,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/sheet";
import { useShop } from "@/components/shop-context";
import { Logo } from "@/components/logo";
import { Avatar, cx, FOCUS, SoonBadge } from "@/components/ui";
import { PLANNED } from "@/lib/dashboard/roadmap";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** On the roadmap, not built yet. */
  soon?: boolean;
};
type Group = { label?: string; items: Item[] };

const PLAN_LABEL: Record<string, string> = { solo: "Solo plan", shop: "Shop plan" };

export function Shell(props: {
  email: string;
  /** Runs Lineup itself: show the way to the admin panel. */
  admin: boolean;
  shops: { slug: string; name: string; plan: string }[];
  children: ReactNode;
}) {
  const shop = useShop();
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const base = `/dashboard/${shop.slug}`;
  const planned = (id: string, icon: LucideIcon): Item[] => {
    const f = PLANNED[id];
    if (!f || (f.managersOnly && !shop.isManager)) return [];
    return [{ href: `${base}/${f.id}`, label: f.label, icon, soon: true }];
  };

  const groups: Group[] = [
    {
      items: [
        { href: base, label: "Home", icon: House, exact: true },
        { href: `${base}/calendar`, label: "Calendar", icon: CalendarDays },
        ...planned("walk-ins", ListOrdered),
        { href: `${base}/clients`, label: "Clients", icon: Users },
        ...planned("payments", CreditCard),
      ],
    },
    {
      label: "Business",
      items: shop.isManager
        ? [
            { href: `${base}/services`, label: "Services", icon: Scissors },
            { href: `${base}/team`, label: "Team", icon: UsersRound },
            ...planned("booth-rent", Armchair),
            ...planned("reports", ChartColumn),
          ]
        : [{ href: `${base}/team/${shop.staffId}`, label: "My hours", icon: UsersRound }],
    },
    ...(shop.isManager
      ? [
          {
            label: "Grow",
            items: [
              { href: `${base}/website`, label: "Website", icon: Globe },
              ...planned("social", Megaphone),
              ...planned("ai-agents", Sparkles),
            ],
          },
          { items: [{ href: `${base}/settings`, label: "Settings", icon: Settings }] },
        ]
      : []),
  ];
  const active = (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  // Phones: the four most used places, plus "More" for the rest.
  const tabs = groups
    .flatMap((g) => g.items)
    .filter((i) => !i.soon)
    .slice(0, 4);
  const plan = props.shops.find((s) => s.slug === shop.slug)?.plan;
  const wide =
    pathname.startsWith(`${base}/calendar`) || pathname.startsWith(`${base}/website/design`);

  return (
    <div className="app-ui md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:sticky md:top-0 md:block md:h-dvh md:p-3 md:pr-0">
        <div className="flex h-full flex-col rounded-3xl bg-sidebar p-3 text-card">
          <Logo className="px-2.5 pb-4 pt-3" />
          <ShopSwitcher shops={props.shops} plan={plan} />
          <nav aria-label="Dashboard" className="mt-3 flex-1 space-y-4 overflow-y-auto">
            {groups.map((group, i) => (
              <div key={group.label ?? i}>
                {group.label ? (
                  <p className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-card/45">
                    {group.label}
                  </p>
                ) : null}
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} active={active(item)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <Account email={props.email} admin={props.admin} />
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-sidebar px-4 py-3 text-card md:hidden">
        <Logo compact />
        <p className="min-w-0 truncate text-sm font-medium text-card/80">{shop.name}</p>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-6 md:px-8 md:pb-12 md:pt-8">
        <div className={cx("mx-auto", wide ? "max-w-[112rem]" : "max-w-6xl")}>{props.children}</div>
      </main>

      {/* Phone tab bar */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {tabs.map((item) => (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active(item) ? "page" : undefined}
            className="flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium text-muted aria-[current=page]:text-ink"
          >
            <span className="relative grid h-7 w-12 place-items-center rounded-full [[aria-current=page]_&]:bg-brand">
              <item.icon className="size-5" aria-hidden />
              <PendingHint className="absolute -right-0.5 -top-0.5 size-3" />
            </span>
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-haspopup="dialog"
          className="flex flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium text-muted"
        >
          <span className="grid h-7 w-12 place-items-center rounded-full">
            <Ellipsis className="size-5" aria-hidden />
          </span>
          More
        </button>
      </nav>
      {more ? (
        <Sheet title="Menu" onClose={() => setMore(false)}>
          <div className="space-y-4">
            {props.shops.length > 1 ? (
              <ul className="space-y-1">
                {props.shops.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/dashboard/${s.slug}` as Route}
                      onClick={() => setMore(false)}
                      aria-current={s.slug === shop.slug ? "true" : undefined}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-paper aria-[current=true]:bg-paper aria-[current=true]:font-semibold"
                    >
                      <Avatar name={s.name} size="sm" />
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {groups.map((group, i) => (
              <div key={group.label ?? i}>
                {group.label ? (
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    {group.label}
                  </p>
                ) : null}
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href as Route}
                        onClick={() => setMore(false)}
                        aria-current={active(item) ? "page" : undefined}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-paper aria-[current=page]:bg-brand"
                      >
                        <item.icon className="size-5" aria-hidden />
                        {item.label}
                        {item.soon ? <SoonBadge className="ml-auto" /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
              <span className="truncate text-muted">{props.email}</span>
              <span className="flex shrink-0 gap-3">
                {props.admin ? (
                  <Link href="/admin" className="font-semibold">
                    Super Admin
                  </Link>
                ) : null}
                <SignOut className="font-semibold" />
              </span>
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href as Route}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-10 items-center gap-3 rounded-xl px-3 font-medium transition-colors",
        item.soon ? "text-card/50 hover:text-card/80" : "text-card/75 hover:text-card",
        "hover:bg-card/8 aria-[current=page]:bg-brand aria-[current=page]:text-brand-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
      )}
    >
      <item.icon className="size-[1.125rem] shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      <span className="ml-auto flex items-center gap-2">
        <PendingHint />
        {item.soon ? (
          <span className="rounded-full bg-card/10 px-1.5 py-px text-[0.625rem] font-semibold uppercase tracking-wide text-card/60 [[aria-current=page]_&]:bg-ink/10 [[aria-current=page]_&]:text-ink/70">
            Soon
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * A small spinner on the link you just clicked while its page is on the
 * way. Always rendered (fixed size) so nothing shifts; only its opacity
 * changes, after a short delay so instant navigations show nothing.
 */
function PendingHint({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <LoaderCircle
      aria-hidden
      data-pending={pending}
      className={cx("nav-pending size-3.5 shrink-0 animate-spin", className)}
    />
  );
}

function ShopSwitcher(props: {
  shops: { slug: string; name: string; plan: string }[];
  plan: string | undefined;
}) {
  const shop = useShop();
  const role = shop.role === "barber" ? "Barber" : shop.role === "owner" ? "Owner" : "Manager";
  const card = (
    <>
      <Avatar name={shop.name} tone="dark" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold">{shop.name}</span>
        <span className="block truncate text-xs text-card/55">
          {props.plan ? `${role} · ${PLAN_LABEL[props.plan] ?? props.plan}` : role}
        </span>
      </span>
    </>
  );
  if (props.shops.length < 2) {
    return <div className="flex items-center gap-3 rounded-2xl bg-card/6 p-2.5">{card}</div>;
  }
  return (
    <details className="relative">
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center gap-3 rounded-2xl bg-card/6 p-2.5 hover:bg-card/10",
          FOCUS,
        )}
      >
        {card}
        <ChevronsUpDown className="size-4 shrink-0 text-card/50" aria-hidden />
      </summary>
      <ul className="absolute inset-x-0 z-30 mt-1 rounded-2xl border border-line bg-card p-1 text-ink shadow-xl">
        {props.shops.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/dashboard/${s.slug}` as Route}
              aria-current={s.slug === shop.slug ? "true" : undefined}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm hover:bg-paper aria-[current=true]:font-semibold"
            >
              <Avatar name={s.name} size="sm" />
              <span className="truncate">{s.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Account({ email, admin }: { email: string; admin: boolean }) {
  const button =
    "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-card/75 hover:bg-card/10 hover:text-card focus-visible:outline-2 focus-visible:outline-brand";
  return (
    <div className="mt-3 rounded-2xl bg-card/6 p-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={email} size="sm" tone="brand" />
        <p className="min-w-0 flex-1 truncate text-sm text-card/75">{email}</p>
      </div>
      <div className="mt-2 flex gap-1">
        {admin ? (
          <Link href="/admin" className={button}>
            <ShieldCheck className="size-3.5" aria-hidden />
            Super Admin
          </Link>
        ) : null}
        <SignOut className={button} icon />
      </div>
    </div>
  );
}

function SignOut({ className, icon = false }: { className: string; icon?: boolean }) {
  return (
    <form action="/auth/signout" method="post" className={icon ? "w-full" : undefined}>
      <button type="submit" className={className}>
        {icon ? <LogOut className="size-3.5" aria-hidden /> : null}
        Sign out
      </button>
    </form>
  );
}
