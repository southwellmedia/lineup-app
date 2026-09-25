import { ListSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading the audit log">
      <PageHeaderSkeleton description />
      <ListSkeleton rows={8} avatar={false} />
    </SkeletonPage>
  );
}
