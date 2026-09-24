import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";

type DbError = { code?: string; message: string };

/**
 * Maps database errors to tRPC errors. The LU* codes are raised by our SQL
 * functions (see CLAUDE.md); their messages are written for end users.
 */
export function toTRPCError(error: DbError): TRPCError {
  switch (error.code) {
    case "LU404":
      return new TRPCError({ code: "NOT_FOUND", message: error.message, cause: error });
    case "LU409":
      return new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
    case "LU410":
      return new TRPCError({ code: "PRECONDITION_FAILED", message: error.message, cause: error });
    case "LU422":
      return new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
    case "42501":
      return new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have access to do that.",
        cause: error,
      });
    default:
      return new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong.",
        cause: error,
      });
  }
}

/** Unwraps a Supabase result, throwing a mapped tRPC error on failure. */
export function unwrap<T>(result: PostgrestSingleResponse<T>): T {
  if (result.error) throw toTRPCError(result.error);
  return result.data;
}
