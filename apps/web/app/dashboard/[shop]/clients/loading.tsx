import { ListSkeleton, PageHeaderSkeleton, Skeleton, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading clients">
      <PageHeaderSkeleton actions={2} description />
      <Skeleton className="mb-4 h-11 rounded-xl" />
      <ListSkeleton rows={8} />
    </SkeletonPage>
  );
}
