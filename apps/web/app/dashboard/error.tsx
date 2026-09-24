"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">We couldn&apos;t load your schedule</h1>
      <p className="mt-1 text-muted">Check your connection and try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full border border-ink px-5 py-2 font-semibold hover:bg-ink hover:text-paper"
      >
        Try again
      </button>
    </main>
  );
}
