import type { CSSProperties, ReactNode } from "react";
import { cx } from "./ui";

/*
 * Loading placeholders shaped like the real components, so a page's
 * loading.tsx can mirror its layout and nothing jumps when data arrives.
 * Compose route skeletons from these; keep them in the same grid as the
 * page they stand in for.
 */

/** One placeholder shape. Size it with classes (h-4 w-32, size-9 rounded-full…). */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  // Default corners unless the caller picks its own (rounded-full for pills and avatars).
  const rounded = className?.includes("rounded") ? null : "rounded-md";
  return <div aria-hidden className={cx("skeleton", rounded, className)} style={style} />;
}

/**
 * Wraps a route's skeleton: announces loading to screen readers and fades
 * in after a beat, so quick navigations show nothing at all.
 */
export function SkeletonPage({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={cx("skeleton-page", className)}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

/** Lines of text, the last one shorter. */
export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cx("h-3.5", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Matches PageHeader: kicker, title, optional description and action buttons. */
export function PageHeaderSkeleton({
  actions = 0,
  description = false,
}: {
  actions?: number;
  description?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-8 w-52" />
        {description ? <Skeleton className="h-4 w-80 max-w-full" /> : null}
      </div>
      {actions ? (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton
              key={i}
              className={cx("h-10 rounded-full", i === actions - 1 ? "w-32" : "w-24")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Matches StatCard. */
export function StatCardSkeleton({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-2xl border p-4 sm:p-5",
        dark ? "skeleton-on-dark border-sidebar bg-sidebar" : "border-line bg-card",
      )}
    >
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-3 h-7 w-24" />
      <Skeleton className="mt-2.5 h-3.5 w-28" />
    </div>
  );
}

/** A row of stat cards; the one at `dark` is the emphasized card. */
export function StatRowSkeleton({ count = 4, dark }: { count?: number; dark?: number }) {
  return (
    <div className={cx("grid grid-cols-2 gap-3", count >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} dark={i === dark} />
      ))}
    </div>
  );
}

/** A Card with a title and some lines. */
export function CardSkeleton({
  lines = 3,
  className,
  children,
}: {
  lines?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("rounded-2xl border border-line bg-card p-5", className)}>
      <Skeleton className="mb-5 h-4.5 w-32" />
      {children ?? <SkeletonText lines={lines} />}
    </div>
  );
}

/** A list in a card: avatar, two lines of text and something on the right. */
export function ListSkeleton({
  rows = 5,
  avatar = true,
  trailing = true,
  className,
}: {
  rows?: number;
  avatar?: boolean;
  trailing?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("divide-y divide-line rounded-2xl border border-line bg-card", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          {avatar ? <Skeleton className="size-10 shrink-0 rounded-full" /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4" style={{ width: `${[42, 34, 48, 38, 30][i % 5]}%` }} />
            <Skeleton className="h-3.5 w-1/4" />
          </div>
          {trailing ? <Skeleton className="h-4 w-16 shrink-0" /> : null}
        </div>
      ))}
    </div>
  );
}

/** A table: header row plus body rows. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex gap-6 border-b border-line bg-paper/50 px-4 py-3">
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex items-center gap-6 border-b border-line px-4 py-4 last:border-0"
        >
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cx("h-4 flex-1", c === 0 && "max-w-40")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A form card: labelled fields in a grid. */
export function FormSkeleton({ fields = 4, columns = 2 }: { fields?: number; columns?: 1 | 2 }) {
  return (
    <CardSkeleton>
      <div className={cx("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        ))}
      </div>
    </CardSkeleton>
  );
}
