import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "@/trpc/init";
import { appRouter } from "@/trpc/router";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`tRPC ${path ?? "unknown"} failed`, error.cause ?? error);
      }
    },
  });
}

export { handler as GET, handler as POST };
