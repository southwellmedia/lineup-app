import { PageHeaderSkeleton, Skeleton, SkeletonPage } from "@/components/skeleton";

const COLUMNS = 3;
// A few appointment blocks per column: [top row, height in rows].
const BLOCKS = [
  [
    [1, 2],
    [4, 1],
    [7, 3],
  ],
  [
    [0, 1],
    [2, 2],
    [6, 2],
  ],
  [
    [1, 1],
    [3, 3],
    [8, 1],
  ],
];

/** Calendar: toolbar, barber columns and a time grid with appointment blocks. */
export default function Loading() {
  return (
    <SkeletonPage label="Loading the calendar">
      <PageHeaderSkeleton actions={2} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-36 rounded-full" />
        <Skeleton className="h-10 w-36 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid grid-cols-[4rem_repeat(3,minmax(0,1fr))] border-b border-line">
          <div />
          {Array.from({ length: COLUMNS }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5 border-l border-line px-3 py-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[4rem_repeat(3,minmax(0,1fr))]">
          <div className="space-y-[2.6rem] px-3 pt-3">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="ml-auto h-3 w-9" />
            ))}
          </div>
          {BLOCKS.map((blocks, c) => (
            <div
              key={c}
              className="relative border-l border-line"
              style={{
                height: "33rem",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0 3.25rem, var(--color-line) 3.25rem calc(3.25rem + 1px))",
              }}
            >
              {blocks.map(([top, rows]) => (
                <Skeleton
                  key={top}
                  className="absolute inset-x-1.5 rounded-xl"
                  style={{ top: `${top! * 3.3 + 0.25}rem`, height: `${rows! * 3.3 - 0.5}rem` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
