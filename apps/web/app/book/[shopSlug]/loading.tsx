import { Skeleton, SkeletonPage } from "@/components/skeleton";

/** The booking page: shop header, step, then a list of services. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <SkeletonPage label="Loading the booking page">
        <div className="mb-8 space-y-2.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-60" />
        </div>
        <div className="mb-6 flex gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-line p-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-5 w-14" />
            </div>
          ))}
        </div>
      </SkeletonPage>
    </main>
  );
}
