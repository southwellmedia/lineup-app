import {
  CardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  SkeletonPage,
  StatRowSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading your website">
      <PageHeaderSkeleton actions={2} description />
      <CardSkeleton>
        <StatRowSkeleton count={4} dark={2} />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </CardSkeleton>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CardSkeleton>
          <Skeleton className="h-96 rounded-xl" />
        </CardSkeleton>
        <div className="space-y-5">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    </SkeletonPage>
  );
}
