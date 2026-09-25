import {
  CardSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  SkeletonPage,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading the design editor">
      <PageHeaderSkeleton actions={2} />
      <div className="grid gap-5 xl:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <CardSkeleton lines={2} />
          <ListSkeleton rows={6} avatar={false} />
        </div>
        <div className="rounded-2xl border border-line bg-card p-3">
          <Skeleton className="h-[70dvh] rounded-xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}
