export default function Loading() {
  return (
    <main className="mx-auto max-w-xl animate-pulse px-4 pt-8 sm:px-6 sm:pt-12" aria-busy="true">
      <div className="mb-8 space-y-2">
        <div className="h-4 w-32 rounded bg-line" />
        <div className="h-8 w-56 rounded bg-line" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3">
        <div className="h-16 rounded-xl bg-line" />
        <div className="h-16 rounded-xl bg-line" />
      </div>
      <div className="h-48 rounded-xl bg-line" />
    </main>
  );
}
