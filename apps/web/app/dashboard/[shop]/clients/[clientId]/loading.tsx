import {
  CardSkeleton,
  PageHeaderSkeleton,
  SkeletonPage,
  StatRowSkeleton,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading client">
      <PageHeaderSkeleton actions={2} description />
      <StatRowSkeleton count={4} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
      <CardSkeleton lines={3} className="mt-5" />
    </SkeletonPage>
  );
}
