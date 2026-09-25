import type { ComponentProps, ReactNode } from "react";

/*
 * Lineup's UI primitives (dashboard, admin, sign-in), styled by the .app-ui
 * tokens in globals.css: white cards on a neutral canvas, ink text and
 * Lineup yellow (`brand` inside .app-ui) as the one accent. Build pages
 * from these instead of restyling raw elements; /dashboard/<shop>/ui shows
 * them all.
 */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

type ButtonProps = ComponentProps<"button"> & {
  /** primary = yellow call to action; dark = ink; secondary = white outline. */
  variant?: "primary" | "dark" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
        size === "sm" ? "h-8 px-3.5 text-sm" : "h-10 px-4.5 text-[0.9375rem]",
        variant === "primary" &&
          "border-brand bg-brand text-brand-ink hover:border-[oklch(0.83_0.17_92)] hover:bg-[oklch(0.83_0.17_92)]",
        variant === "dark" && "border-ink bg-ink text-card hover:bg-ink/85",
        variant === "secondary" && "border-line bg-card hover:border-ink/40",
        variant === "danger" &&
          "border-danger/40 bg-card text-danger hover:bg-danger hover:text-card",
        variant === "ghost" && "border-transparent text-muted hover:bg-ink/5 hover:text-ink",
        FOCUS,
        className,
      )}
      {...props}
    />
  );
}

/** A round icon-only button. `label` is read by screen readers. */
export function IconButton({
  label,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "relative inline-grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-ink transition-colors hover:border-ink/40 disabled:opacity-40 [&_svg]:size-[1.125rem]",
        FOCUS,
        className,
      )}
      {...props}
    />
  );
}

export function Field(props: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <label htmlFor={props.htmlFor} className="mb-1.5 block text-sm font-medium">
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <p id={`${props.htmlFor}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {props.error}
        </p>
      ) : props.hint ? (
        <p id={`${props.htmlFor}-hint`} className="mt-1.5 text-sm text-muted">
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}

const INPUT =
  "h-11 rounded-xl border border-line bg-card px-3.5 outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 focus:border-ink/50 focus:ring-4 focus:ring-brand/35 aria-[invalid=true]:border-danger disabled:opacity-60";

/** Full width by default; pass `width` (e.g. "w-32") for a compact field. */
export function Input({
  className,
  width = "w-full",
  ...props
}: ComponentProps<"input"> & { width?: string }) {
  return <input className={cx(INPUT, width, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(INPUT, "h-auto min-h-24 w-full py-2.5", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(INPUT, "select-chevron w-full appearance-none bg-card pr-9", className)}
      {...props}
    />
  );
}

/** A money input in dollars; callers convert to cents. */
export function MoneyInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div
      className={cx(
        "flex h-11 items-center rounded-xl border border-line bg-card px-3.5 transition-[border-color,box-shadow] focus-within:border-ink/50 focus-within:ring-4 focus-within:ring-brand/35",
        className,
      )}
    >
      <span className="text-muted">$</span>
      <input
        inputMode="decimal"
        className="w-full bg-transparent px-1 tabular-nums outline-none"
        {...props}
      />
    </div>
  );
}

export function Switch(props: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label htmlFor={props.id} className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{props.label}</span>
        {props.description ? (
          <span className="block text-sm text-muted">{props.description}</span>
        ) : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={props.id}
          type="checkbox"
          role="switch"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
        />
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 size-5 rounded-full bg-card shadow-sm ring-1 ring-ink/5 transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_oklch(0_0_0/0.03)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[1.0625rem] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader(props: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {props.kicker ? <p className="text-sm font-medium text-muted">{props.kicker}</p> : null}
        <h1 className="text-3xl font-bold tracking-tight">{props.title}</h1>
        {props.description ? (
          <p className="mt-1.5 max-w-xl text-muted">{props.description}</p>
        ) : null}
      </div>
      {props.action ? (
        <div className="flex flex-wrap items-center gap-2">{props.action}</div>
      ) : null}
    </header>
  );
}

export type BadgeTone = "neutral" | "ink" | "brand" | "danger" | "muted" | "success" | "warning";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold [&_svg]:size-3",
        tone === "neutral" && "bg-card text-ink ring-1 ring-line",
        tone === "ink" && "bg-ink text-card",
        tone === "brand" && "bg-brand text-brand-ink",
        tone === "danger" && "bg-danger/12 text-danger",
        tone === "muted" && "bg-ink/6 text-muted",
        tone === "success" && "bg-success/12 text-success",
        tone === "warning" && "bg-warning/15 text-[oklch(0.45_0.12_65)]",
      )}
    >
      {children}
    </span>
  );
}

/** Marks a feature that's on the roadmap but not built yet. */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "rounded-full bg-ink/6 px-1.5 py-px text-[0.6875rem] font-semibold uppercase tracking-wide text-muted",
        className,
      )}
    >
      Soon
    </span>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-xl px-4 py-3 text-sm font-medium",
        tone === "error" ? "bg-danger/10 text-danger" : "bg-success/12 text-success",
      )}
    >
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/60 p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children ? <div className="mt-1 text-muted">{children}</div> : null}
    </div>
  );
}

/** A headline number. `dark` is the emphasized card (money, the thing to watch). */
export function StatCard(props: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "dark";
  className?: string;
}) {
  const dark = props.tone === "dark";
  return (
    <div
      className={cx(
        "rounded-2xl border p-4 sm:p-5",
        dark
          ? "border-sidebar bg-sidebar text-card"
          : "border-line bg-card shadow-[0_1px_2px_oklch(0_0_0/0.03)]",
        props.className,
      )}
    >
      <p className={cx("text-sm", dark ? "text-card/70" : "text-muted")}>{props.label}</p>
      <p
        className={cx(
          "mt-1 text-[1.75rem] font-bold leading-tight tracking-tight tabular-nums",
          dark && "text-brand",
        )}
      >
        {props.value}
      </p>
      {props.hint ? (
        <p className={cx("mt-0.5 text-sm", dark ? "text-card/70" : "text-muted")}>{props.hint}</p>
      ) : null}
    </div>
  );
}

/** One choice from a few (Day / Week / Month). */
export function Segmented<T extends string>(props: {
  label: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={props.label}
      className={cx("inline-flex rounded-full bg-ink/6 p-1", props.className)}
    >
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === props.value}
          onClick={() => props.onChange(o.value)}
          className={cx(
            "h-8 rounded-full px-3.5 text-sm font-medium text-muted transition-colors hover:text-ink aria-checked:bg-card aria-checked:text-ink aria-checked:shadow-sm",
            FOCUS,
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A filter pill. Active chips are ink. */
export function Chip({
  active = false,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cx(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-ink bg-ink text-card" : "border-line bg-card hover:border-ink/40",
        FOCUS,
        className,
      )}
      {...props}
    />
  );
}

/** Initials in a circle. `color` tints it (barber colors on the calendar). */
export function Avatar({
  name,
  color,
  size = "md",
  tone = "default",
  className,
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  /** dark = on the sidebar; brand = yellow. */
  tone?: "default" | "dark" | "brand";
  className?: string;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden
      style={
        color
          ? {
              backgroundColor: `color-mix(in oklch, ${color} 20%, white)`,
              color: `color-mix(in oklch, ${color} 75%, black)`,
            }
          : undefined
      }
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold",
        tone === "default" && "bg-ink/6 text-ink",
        tone === "dark" && "bg-card/10 text-card",
        tone === "brand" && "bg-brand text-brand-ink",
        size === "sm" && "size-7 text-[0.6875rem]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-12 text-sm",
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** A data table in a card. Scrolls sideways on small screens. */
export function Table({
  children,
  minWidth = "40rem",
  className,
}: {
  children: ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <div className={cx("overflow-x-auto rounded-2xl border border-line bg-card", className)}>
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cx(
        "border-b border-line bg-paper/50 px-4 py-2.5 text-xs font-medium text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cx("border-b border-line px-4 py-3 align-middle", className)} {...props} />;
}

/** Pulls the first message for each field out of a tRPC error's zod details. */
export function fieldErrors(error: unknown): Record<string, string | undefined> {
  const fe = (
    error as {
      data?: { zodError?: { fieldErrors?: Record<string, string[] | undefined> } };
    } | null
  )?.data?.zodError?.fieldErrors;
  return fe ? Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) : {};
}

/** Dollars typed by a person → integer cents, or null if it isn't a valid amount. */
export function toCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}
