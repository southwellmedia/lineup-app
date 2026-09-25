import { ListSkeleton, PageHeaderSkeleton, Skeleton, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading services">
      <PageHeaderSkeleton actions={1} description />
      <Skeleton className="mb-3 h-4.5 w-24" />
      <ListSkeleton rows={4} avatar={false} />
      <Skeleton className="mb-3 mt-8 h-4.5 w-20" />
      <ListSkeleton rows={2} avatar={false} />
    </SkeletonPage>
  );
}
