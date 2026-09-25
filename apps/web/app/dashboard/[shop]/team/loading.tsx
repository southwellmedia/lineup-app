import { ListSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading the team">
      <PageHeaderSkeleton actions={1} description />
      <ListSkeleton rows={4} />
    </SkeletonPage>
  );
}
