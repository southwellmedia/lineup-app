import type { ComponentProps, ReactNode } from "react";

/* Shared admin UI primitives. Client-facing pages use --brand; the admin
 * uses ink as its primary and brand only for small accents. */

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
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
        "inline-flex items-center justify-center gap-2 rounded-full border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-3.5 py-1.5 text-sm" : "px-5 py-2.5",
        variant === "primary" &&
          "border-ink bg-ink text-paper hover:bg-brand hover:border-brand hover:text-brand-ink",
        variant === "secondary" && "border-line bg-card hover:border-ink",
        variant === "danger" && "border-danger text-danger hover:bg-danger hover:text-paper",
        variant === "ghost" && "border-transparent text-muted hover:text-ink",
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
      <label htmlFor={props.htmlFor} className="mb-1.5 block text-sm font-semibold">
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
  "rounded-xl border border-line bg-card px-3.5 py-2.5 outline-none transition-colors placeholder:text-muted/60 focus:border-ink focus-visible:ring-2 focus-visible:ring-brand/30 aria-[invalid=true]:border-danger disabled:opacity-60";

/** Full width by default; pass `width` (e.g. "w-32") for a compact field. */
export function Input({
  className,
  width = "w-full",
  ...props
}: ComponentProps<"input"> & { width?: string }) {
  return <input className={cx(INPUT, width, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(INPUT, "w-full min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(INPUT, "w-full appearance-none bg-card pr-8", className)} {...props} />
  );
}

/** A money input in dollars; callers convert to cents. */
export function MoneyInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div
      className={cx(
        "flex items-center rounded-xl border border-line bg-card px-3.5 focus-within:border-ink focus-within:ring-2 focus-within:ring-brand/30",
        className,
      )}
    >
      <span className="text-muted">$</span>
      <input
        inputMode="decimal"
        className="w-full bg-transparent px-1 py-2.5 tabular-nums outline-none"
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
        <span className="block font-semibold">{props.label}</span>
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
          className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"
        />
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 size-5 rounded-full bg-card shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-2xl border border-line bg-card p-5", className)} {...props} />
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-bold uppercase tracking-tight">{children}</h2>
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
      <div>
        {props.kicker ? (
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            {props.kicker}
          </p>
        ) : null}
        <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight">
          {props.title}
        </h1>
        {props.description ? <p className="mt-2 max-w-xl text-muted">{props.description}</p> : null}
      </div>
      {props.action}
    </header>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ink" | "brand" | "danger" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-paper text-ink ring-1 ring-line",
        tone === "ink" && "bg-ink text-paper",
        tone === "brand" && "bg-brand text-brand-ink",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "muted" && "bg-line text-muted",
      )}
    >
      {children}
    </span>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-xl px-4 py-3 text-sm font-medium",
        tone === "error" ? "bg-danger/10 text-danger" : "bg-ink text-paper",
      )}
    >
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <p className="font-display text-2xl font-bold uppercase">{title}</p>
      {children ? <div className="mt-1 text-muted">{children}</div> : null}
    </div>
  );
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
