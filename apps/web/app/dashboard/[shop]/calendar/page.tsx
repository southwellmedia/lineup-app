import type { Metadata } from "next";
import { shopToday } from "@/lib/booking/slots";
import { weekStart } from "@/lib/calendar/grid";
import { viewerShop } from "@/lib/dashboard/viewer";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "Calendar · Lineup" };

type Props = {
  params: Promise<{ shop: string }>;
  searchParams: Promise<{ date?: string; view?: string; walkin?: string }>;
};

export default async function CalendarPage({ params, searchParams }: Props) {
  const [{ shop: slug }, query] = await Promise.all([params, searchParams]);
  const shop = await viewerShop(slug);
  const today = shopToday(shop.timezone);
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : today;
  const view = query.view === "week" ? "week" : "day";

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(
      trpc.calendar.range.queryOptions({
        shopId: shop.id,
        start: view === "week" ? weekStart(date) : date,
        days: view === "week" ? 7 : 1,
      }),
    ),
    queryClient.prefetchQuery(trpc.services.list.queryOptions({ shopId: shop.id })),
  ]);

  return (
    <HydrateClient>
      <CalendarView
        initialDate={date}
        initialView={view}
        today={today}
        openWalkIn={query.walkin === "1"}
      />
    </HydrateClient>
  );
}
