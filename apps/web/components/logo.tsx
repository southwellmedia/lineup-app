import { cx } from "./ui";

/** "lineup" beside three bars of decreasing length: a line of chairs. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 20 16"
        aria-hidden
        className={compact ? "h-4 w-5" : "h-[1.125rem] w-[1.375rem]"}
      >
        <rect width="20" height="4" rx="2" fill="var(--color-brand)" />
        <rect y="6" width="14" height="4" rx="2" fill="var(--color-brand)" />
        <rect y="12" width="9" height="4" rx="2" fill="var(--color-brand)" />
      </svg>
      <span className={cx("font-bold tracking-tight", compact ? "text-lg" : "text-xl")}>
        lineup
      </span>
    </span>
  );
}
