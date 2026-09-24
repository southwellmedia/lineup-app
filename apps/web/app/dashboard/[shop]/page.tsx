import { shopToday } from "@/lib/booking/slots";
import { getQueryClient, HydrateClient, serverCaller, trpc } from "@/trpc/server";
import { DayBoard } from "./day-board";

type Props = { params: Promise<{ shop: string }>; searchParams: Promise<{ date?: string }> };

export default async function TodayPage({ params, searchParams }: Props) {
  const [{ shop: slug }, { date: requested }] = await Promise.all([params, searchParams]);
  const shop = (await (await serverCaller()).me.shops()).find((s) => s.slug === slug);
  if (!shop) return null; // the layout already 404s

  const today = shopToday(shop.timezone);
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  await getQueryClient().prefetchQuery(trpc.schedule.day.queryOptions({ shopId: shop.id, date }));

  return (
    <HydrateClient>
      <DayBoard date={date} today={today} />
    </HydrateClient>
  );
}
