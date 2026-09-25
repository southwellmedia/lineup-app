"use client";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import type { Route } from "next";
import Link from "next/link";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { useTRPC } from "@/trpc/client";
import { describeAudit } from "@/lib/admin/describe";

export function AuditLog() {
  const trpc = useTRPC();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    trpc.admin.audit.infiniteQueryOptions({}, { getNextPageParam: (page) => page.next }),
  );
  const entries = data.pages.flatMap((p) => p.entries);

  return (
    <>
      <PageHeader
        kicker="Lineup"
        title="Audit log"
        description="Every change made from this panel. Entries can't be edited or deleted."
      />
      {entries.length === 0 ? (
        <EmptyState title="Nothing yet">Changes to shops show up here.</EmptyState>
      ) : (
        <ol className="divide-y divide-line rounded-2xl border border-line bg-card">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p>
                  {e.shop ? (
                    <Link
                      href={`/admin/shops/${e.shop.id}` as Route}
                      className="font-semibold underline decoration-line underline-offset-4 hover:decoration-ink"
                    >
                      {e.shop.name}
                    </Link>
                  ) : null}
                  {e.shop ? ": " : ""}
                  {describeAudit(e.action, e.detail)}
                </p>
                <p className="text-xs text-muted">{e.by}</p>
              </div>
              <time dateTime={e.at} className="text-sm text-muted">
                {DateTime.fromISO(e.at).toFormat("LLL d, yyyy h:mm a")}
              </time>
            </li>
          ))}
        </ol>
      )}
      {hasNextPage ? (
        <Button className="mt-4" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          {isFetchingNextPage ? "Loading…" : "Older"}
        </Button>
      ) : null}
    </>
  );
}
