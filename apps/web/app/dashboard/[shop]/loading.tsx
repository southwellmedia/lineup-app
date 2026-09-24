export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="pole mb-6 h-2 animate-pole rounded-full" />
      <div className="animate-pulse space-y-3">
        <div className="h-12 w-64 rounded bg-line" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-2xl bg-line" />
          <div className="h-20 rounded-2xl bg-line" />
          <div className="h-20 rounded-2xl bg-line" />
        </div>
        <div className="h-28 rounded-2xl bg-line" />
        <div className="h-28 rounded-2xl bg-line" />
      </div>
    </div>
  );
}
