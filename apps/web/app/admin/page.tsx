import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { Overview } from "./overview";

export default async function AdminPage() {
  await getQueryClient().prefetchQuery(trpc.admin.overview.queryOptions());
  return (
    <HydrateClient>
      <Overview />
    </HydrateClient>
  );
}
