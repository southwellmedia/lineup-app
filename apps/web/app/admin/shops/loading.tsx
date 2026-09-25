import { PageHeaderSkeleton, Skeleton, SkeletonPage, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading shops">
      <PageHeaderSkeleton description />
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-11 w-80 max-w-full rounded-xl" />
        <Skeleton className="h-11 w-44 rounded-xl" />
      </div>
      <TableSkeleton rows={6} cols={6} />
    </SkeletonPage>
  );
}
