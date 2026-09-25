import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { ShopsTable } from "./shops-table";

export const metadata = { title: "Shops · Lineup admin" };

export default async function AdminShopsPage() {
  await getQueryClient().prefetchQuery(trpc.admin.shops.queryOptions());
  return (
    <HydrateClient>
      <ShopsTable />
    </HydrateClient>
  );
}
