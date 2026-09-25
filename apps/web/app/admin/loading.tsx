import {
  CardSkeleton,
  PageHeaderSkeleton,
  SkeletonPage,
  StatRowSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading overview">
      <PageHeaderSkeleton description />
      <StatRowSkeleton count={4} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </SkeletonPage>
  );
}
