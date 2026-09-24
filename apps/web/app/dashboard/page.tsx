import { shopToday } from "@/lib/booking/slots";
import { getQueryClient, HydrateClient, serverCaller, trpc } from "@/trpc/server";
import { DayBoard } from "./day-board";

type Props = { searchParams: Promise<{ shop?: string; date?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const shops = await (await serverCaller()).me.shops();

  if (shops.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-black uppercase">No shop yet</h1>
        <p className="mt-2 max-w-md text-muted">
          You&apos;re signed in, but this email isn&apos;t on any shop&apos;s team. Ask the shop
          owner to add you with this email, then sign in again.
        </p>
      </main>
    );
  }

  const shop = shops.find((s) => s.id === params.shop) ?? shops[0];
  if (!shop) return null;
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : shopToday(shop.timezone);

  await getQueryClient().prefetchQuery(trpc.schedule.day.queryOptions({ shopId: shop.id, date }));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <HydrateClient>
        <DayBoard
          shopId={shop.id}
          date={date}
          today={shopToday(shop.timezone)}
          shops={shops.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
        />
      </HydrateClient>
    </main>
  );
}
