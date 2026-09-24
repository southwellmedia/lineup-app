"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-10">
      <h1 className="font-display text-3xl font-black uppercase">Something went wrong</h1>
      <p className="mt-1 text-muted">{error.message || "Check your connection and try again."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full border border-ink px-5 py-2 font-semibold hover:bg-ink hover:text-paper"
      >
        Try again
      </button>
    </div>
  );
}
