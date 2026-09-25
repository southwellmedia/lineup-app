import {
  CardSkeleton,
  FormSkeleton,
  PageHeaderSkeleton,
  SkeletonPage,
} from "@/components/skeleton";

export default function Loading() {
  return (
    <SkeletonPage label="Loading team member">
      <PageHeaderSkeleton description />
      <FormSkeleton fields={4} />
      <CardSkeleton lines={7} className="mt-5" />
    </SkeletonPage>
  );
}
