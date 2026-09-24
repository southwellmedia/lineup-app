"use client";

export default function BookingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-3 px-4 py-16 sm:px-6">
      <h1 className="text-xl font-semibold">We couldn&apos;t load this booking page</h1>
      <p className="text-muted">Please try again in a moment.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-line bg-card px-4 py-2 font-medium hover:bg-surface"
      >
        Try again
      </button>
    </main>
  );
}
