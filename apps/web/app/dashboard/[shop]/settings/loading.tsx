import { FormSkeleton, PageHeaderSkeleton, SkeletonPage } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading settings" className="space-y-5">
      <PageHeaderSkeleton />
      <FormSkeleton fields={3} />
      <FormSkeleton fields={6} />
      <FormSkeleton fields={4} />
    </SkeletonPage>
  );
}
