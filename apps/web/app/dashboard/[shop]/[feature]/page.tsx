import { Check, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { viewerShop } from "@/lib/dashboard/viewer";
import { isPlanned, PLANNED } from "@/lib/dashboard/roadmap";

type Props = { params: Promise<{ shop: string; feature: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { feature } = await params;
  return { title: `${PLANNED[feature]?.title ?? "Coming soon"} · Lineup` };
}

/**
 * A section of the dashboard that's designed but not built yet. Real
 * routes (static segments) take precedence, so building a feature means
 * adding its folder and removing it from PLANNED.
 */
export default async function PlannedFeaturePage({ params }: Props) {
  const { shop: slug, feature: id } = await params;
  if (!isPlanned(id)) notFound();
  const feature = PLANNED[id]!;
  const shop = await viewerShop(slug);
  if (feature.managersOnly && !shop.isManager) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Badge tone="brand">
          <Sparkles aria-hidden />
          Coming soon
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{feature.title}</h1>
        <p className="mt-1.5 text-lg text-muted">{feature.pitch}</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">What&apos;s planned</h2>
        <ul className="space-y-2.5">
          {feature.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </Card>

      {feature.today ? (
        <p className="mt-4 rounded-2xl bg-card/60 px-5 py-4 text-sm text-muted ring-1 ring-line">
          <span className="font-semibold text-ink">Today: </span>
          {feature.today}
        </p>
      ) : null}
    </div>
  );
}
