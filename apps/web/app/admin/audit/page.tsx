import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { AuditLog } from "./audit-log";

export const metadata = { title: "Audit log · Lineup admin" };

export default async function AdminAuditPage() {
  await getQueryClient().prefetchInfiniteQuery(
    trpc.admin.audit.infiniteQueryOptions({}, { getNextPageParam: (page) => page.next }),
  );
  return (
    <HydrateClient>
      <AuditLog />
    </HydrateClient>
  );
}
