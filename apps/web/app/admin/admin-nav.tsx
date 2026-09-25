"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/shops", label: "Shops" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
      {ITEMS.map((item) => {
        const active = "exact" in item ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-paper/70 transition-colors hover:text-paper aria-[current=page]:bg-paper aria-[current=page]:text-ink"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
