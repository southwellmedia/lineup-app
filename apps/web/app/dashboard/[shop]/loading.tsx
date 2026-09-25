import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  SkeletonPage,
  StatRowSkeleton,
} from "@/components/skeleton";

/** Home: stats, the schedule and the side rail. */
export default function Loading() {
  return (
    <SkeletonPage label="Loading today" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <PageHeaderSkeleton actions={3} />
        <StatRowSkeleton count={4} dark={2} />
        <div className="mb-3 mt-6 flex items-center justify-between">
          <Skeleton className="h-4.5 w-24" />
          <div className="flex gap-1.5">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-line bg-card p-4">
              <div className="w-[5.5rem] shrink-0 space-y-2 border-r border-line pr-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex-1 space-y-2.5">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3.5 w-64 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <CardSkeleton lines={2} />
        <CardSkeleton>
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-8" />
                </div>
                <Skeleton className="h-1.5 rounded-full" />
              </div>
            ))}
          </div>
        </CardSkeleton>
        <CardSkeleton>
          <Skeleton className="h-11 rounded-xl" />
        </CardSkeleton>
      </div>
    </SkeletonPage>
  );
}
