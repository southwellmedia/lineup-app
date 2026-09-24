import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCents } from "@/lib/format/money";
import { serverCaller } from "@/trpc/server";

type Props = { params: Promise<{ shopSlug: string }> };

async function loadShop(slug: string) {
  try {
    return await (await serverCaller()).booking.shop({ slug });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shopSlug } = await params;
  const { shop } = await loadShop(shopSlug);
  return { title: `Book at ${shop.name}` };
}

/**
 * A shop's booking page. For now it shows the menu; picking a time and
 * checking out are the next step.
 */
export default async function BookingPage({ params }: Props) {
  const { shopSlug } = await params;
  const { shop, barbers, services } = await loadShop(shopSlug);
  const mainServices = services.filter((s) => !s.isAddon);
  const addons = services.filter((s) => s.isAddon);

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm text-muted">Book an appointment</p>
        <h1 className="text-3xl font-semibold tracking-tight">{shop.name}</h1>
      </header>

      <section aria-labelledby="barbers" className="mb-8">
        <h2 id="barbers" className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Barbers
        </h2>
        <ul className="grid grid-cols-2 gap-3">
          {barbers.map((barber) => (
            <li key={barber.id} className="rounded-xl border border-line bg-card p-4">
              <p className="font-medium">{barber.name}</p>
              {barber.bio ? <p className="mt-1 text-sm text-muted">{barber.bio}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <ServiceList title="Services" services={mainServices} />
      {addons.length > 0 ? <ServiceList title="Add-ons" services={addons} /> : null}
    </main>
  );
}

type Service = Awaited<ReturnType<typeof loadShop>>["services"][number];

function ServiceList({ title, services }: { title: string; services: Service[] }) {
  return (
    <section aria-label={title} className="mb-8">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {services.map((service) => {
          const prices = service.offeredBy.map((o) => o.priceCents);
          const low = Math.min(...prices, service.priceCents);
          const high = Math.max(...prices, service.priceCents);
          return (
            <li key={service.id} className="flex items-baseline justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-muted">{service.durationMinutes} min</p>
              </div>
              <p className="font-medium tabular-nums">
                {low === high ? formatCents(low) : `${formatCents(low)}–${formatCents(high)}`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
