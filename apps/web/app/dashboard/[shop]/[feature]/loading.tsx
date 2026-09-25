import { CardSkeleton, Skeleton, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading" className="mx-auto max-w-3xl">
      <Skeleton className="h-5 w-28 rounded-full" />
      <Skeleton className="mt-3 h-8 w-64" />
      <Skeleton className="mb-6 mt-2.5 h-5 w-96 max-w-full" />
      <CardSkeleton lines={5} />
    </SkeletonPage>
  );
}
