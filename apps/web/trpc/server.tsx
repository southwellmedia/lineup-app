import "server-only";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache, type ReactNode } from "react";
import { createContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter, createCaller } from "./router";

/** One QueryClient per request. */
export const getQueryClient = cache(makeQueryClient);

/** For Server Components: `await queryClient.prefetchQuery(trpc.booking.shop.queryOptions(...))`. */
export const trpc = createTRPCOptionsProxy({
  ctx: createContext,
  router: appRouter,
  queryClient: getQueryClient,
});

/** Direct server-side calls, for when a page needs the data itself. */
export async function serverCaller() {
  return createCaller(await createContext());
}

/** Hands prefetched queries to Client Components. */
export function HydrateClient({ children }: { children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}
