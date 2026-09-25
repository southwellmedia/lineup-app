import {
  CardSkeleton,
  ListSkeleton,
  PageHeaderSkeleton,
  SkeletonPage,
  StatRowSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading shop">
      <PageHeaderSkeleton actions={2} />
      <StatRowSkeleton count={4} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <ListSkeleton rows={3} />
          <CardSkeleton lines={3} />
        </div>
        <div className="space-y-5">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    </SkeletonPage>
  );
}
