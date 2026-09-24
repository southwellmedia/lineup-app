"use client";

import { useMutation, useQueries, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { buildIcs } from "@/lib/booking/ics";
import { priceRange, quoteFor, type Quote } from "@/lib/booking/quote";
import {
  formatLongDate,
  formatTime,
  groupByDayPart,
  groupSlotsByDate,
  mergeSlots,
  nextDates,
  shopToday,
} from "@/lib/booking/slots";
import { formatCents } from "@/lib/format/money";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/router";

type Outputs = inferRouterOutputs<AppRouter>;
type Menu = Outputs["booking"]["shop"];
type Hold = Outputs["booking"]["hold"];
type Confirmed = Outputs["booking"]["confirm"];
export type PublicSource =
  "booking_link" | "website" | "instagram" | "google" | "referral" | "other";

type Step = "service" | "barber" | "time" | "details" | "done";
const STEPS: Step[] = ["service", "barber", "time", "details"];
const ANY = "any";
/** How far ahead the date picker looks (the API allows up to 14 days per request). */
const DAYS_AHEAD = 14;

export function BookingFlow({
  slug,
  source,
  preselect = {},
}: {
  slug: string;
  source: PublicSource;
  /** From ?service= and ?barber= links, e.g. on the shop's website. Ignored if they don't exist. */
  preselect?: { serviceIds?: string[]; barberId?: string };
}) {
  const trpc = useTRPC();
  const { data: menu } = useSuspenseQuery(trpc.booking.shop.queryOptions({ slug }));
  const preferredBarber = menu.barbers.some((b) => b.id === preselect.barberId)
    ? preselect.barberId
    : undefined;

  const [step, setStep] = useState<Step>("service");
  const [mainId, setMainId] = useState<string | null>(
    () => menu.services.find((s) => preselect.serviceIds?.includes(s.id) && !s.isAddon)?.id ?? null,
  );
  const [addonIds, setAddonIds] = useState<string[]>(() =>
    menu.services.filter((s) => s.isAddon && preselect.serviceIds?.includes(s.id)).map((s) => s.id),
  );
  const [barber, setBarber] = useState<string | null>(null);
  const [hold, setHold] = useState<(Hold & { staffId: string }) | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  const serviceIds = useMemo(() => (mainId ? [mainId, ...addonIds] : []), [mainId, addonIds]);
  const eligibleBarbers = useMemo(
    () =>
      menu.barbers
        .map((b) => ({ ...b, quote: quoteFor(menu.services, serviceIds, b.id) }))
        .filter((b): b is typeof b & { quote: Quote } => b.quote !== null),
    [menu, serviceIds],
  );

  const reset = () => {
    setStep("service");
    setMainId(null);
    setAddonIds([]);
    setBarber(null);
    setHold(null);
    setConfirmed(null);
  };

  const back = () => {
    const i = STEPS.indexOf(step);
    const prev = STEPS[i - 1];
    if (prev) setStep(prev);
  };

  return (
    <div className="pb-32">
      {step !== "done" ? (
        <Progress step={step} onBack={step === "service" ? undefined : back} />
      ) : null}

      {step === "service" ? (
        <ServiceStep
          menu={menu}
          mainId={mainId}
          addonIds={addonIds}
          onMain={(id) => {
            setMainId(id);
            // Add-ons depend on who offers the main service, so start them fresh.
            setAddonIds([]);
          }}
          onToggleAddon={(id) =>
            setAddonIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
          }
          onContinue={() => {
            // Came from a barber's page: go straight to their times if they do all of it.
            if (preferredBarber && eligibleBarbers.some((b) => b.id === preferredBarber)) {
              setBarber(preferredBarber);
              setStep("time");
              return;
            }
            setBarber(null);
            setStep("barber");
          }}
          eligibleCount={eligibleBarbers.length}
        />
      ) : null}

      {step === "barber" ? (
        <BarberStep
          barbers={eligibleBarbers}
          selected={barber}
          onSelect={(id) => {
            setBarber(id);
            setStep("time");
          }}
        />
      ) : null}

      {step === "time" && barber ? (
        <TimeStep
          slug={slug}
          timezone={menu.shop.timezone}
          serviceIds={serviceIds}
          staffIds={
            barber === ANY
              ? // "Any barber" advertises the lowest price, so try the cheapest free barber first.
                [...eligibleBarbers]
                  .sort((x, y) => x.quote.priceCents - y.quote.priceCents)
                  .map((b) => b.id)
              : [barber]
          }
          source={source}
          onHeld={(h) => {
            setHold(h);
            setStep("details");
          }}
        />
      ) : null}

      {step === "details" && hold ? (
        <DetailsStep
          menu={menu}
          hold={hold}
          serviceIds={serviceIds}
          onExpired={() => {
            setHold(null);
            setStep("time");
          }}
          onConfirmed={(c) => {
            setConfirmed(c);
            setStep("done");
          }}
        />
      ) : null}

      {step === "done" && confirmed && hold ? (
        <DoneStep
          menu={menu}
          confirmed={confirmed}
          staffId={hold.staffId}
          serviceIds={serviceIds}
          onAgain={reset}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const STEP_LABELS: Record<Step, string> = {
  service: "Service",
  barber: "Barber",
  time: "Time",
  details: "Details",
  done: "Done",
};

function Progress({ step, onBack }: { step: Step; onBack: (() => void) | undefined }) {
  const index = STEPS.indexOf(step);
  return (
    <nav aria-label="Booking steps" className="mb-8">
      <div className="mb-3 flex items-center justify-between text-sm">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 rounded-md px-2 py-1 font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-muted">
          Step {index + 1} of {STEPS.length} · <span className="text-ink">{STEP_LABELS[step]}</span>
        </span>
      </div>
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="h-1.5 overflow-hidden rounded-full bg-line">
            <span className="sr-only">
              {STEP_LABELS[s]}
              {i < index ? " (done)" : i === index ? " (current)" : ""}
            </span>
            {i < index ? <div className="h-full bg-ink" /> : null}
            {i === index ? <div className="pole h-full animate-pole" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StepHeading({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <header className="mb-6 animate-rise">
      <p className="font-serif text-lg text-muted">{kicker}</p>
      <h2 className="font-display text-4xl font-extrabold uppercase leading-none tracking-tight">
        {children}
      </h2>
    </header>
  );
}

/** Staggers list items as they appear. */
const rise = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 45}ms` });

/* -------------------------------------------------------------------------- */

function ServiceStep(props: {
  menu: Menu;
  mainId: string | null;
  addonIds: string[];
  onMain: (id: string) => void;
  onToggleAddon: (id: string) => void;
  onContinue: () => void;
  eligibleCount: number;
}) {
  const { menu, mainId, addonIds } = props;
  const mains = menu.services.filter((s) => !s.isAddon);
  // Only show add-ons that at least one barber offering the chosen service also does.
  const mainOffers = new Set(
    menu.services.find((s) => s.id === mainId)?.offeredBy.map((o) => o.staffId),
  );
  const addons = menu.services.filter(
    (s) => s.isAddon && s.offeredBy.some((o) => mainOffers.has(o.staffId)),
  );

  const selected = menu.services.filter((s) => s.id === mainId || addonIds.includes(s.id));
  const low = selected.reduce((sum, s) => sum + priceRange(s).low, 0);
  const minutes = selected.reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <section aria-labelledby="service-heading">
      <StepHeading kicker="What are we doing today?">
        <span id="service-heading">Pick a service</span>
      </StepHeading>

      <fieldset>
        <legend className="sr-only">Service</legend>
        <ul className="space-y-2.5">
          {mains.map((service, i) => {
            const { low: from, high } = priceRange(service);
            return (
              <li key={service.id} className="animate-rise" style={rise(i)}>
                <ChoiceCard
                  type="radio"
                  name="service"
                  checked={mainId === service.id}
                  onChange={() => props.onMain(service.id)}
                  title={service.name}
                  meta={`${service.durationMinutes} min`}
                  price={from === high ? formatCents(from) : `from ${formatCents(from)}`}
                  description={service.description}
                />
              </li>
            );
          })}
        </ul>
      </fieldset>

      {mainId && addons.length > 0 ? (
        <fieldset className="mt-8 animate-rise">
          <legend className="mb-3 font-display text-xl font-bold uppercase tracking-wide">
            Add something?
          </legend>
          <ul className="space-y-2.5">
            {addons.map((service, i) => (
              <li key={service.id} className="animate-rise" style={rise(i)}>
                <ChoiceCard
                  type="checkbox"
                  name="addons"
                  checked={addonIds.includes(service.id)}
                  onChange={() => props.onToggleAddon(service.id)}
                  title={service.name}
                  meta={`+${service.durationMinutes} min`}
                  price={`+${formatCents(priceRange(service).low)}`}
                  description={service.description}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <BottomBar>
        <div>
          <p className="text-sm text-muted">
            {selected.length ? `${minutes} min` : "Nothing selected"}
          </p>
          <p className="font-display text-2xl font-bold tabular-nums">
            {selected.length ? `${formatCents(low)}${props.eligibleCount > 1 ? "+" : ""}` : "—"}
          </p>
        </div>
        <PrimaryButton disabled={!mainId || props.eligibleCount === 0} onClick={props.onContinue}>
          Choose barber
        </PrimaryButton>
      </BottomBar>
      {mainId && props.eligibleCount === 0 ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          No single barber offers all of those. Try removing an add-on.
        </p>
      ) : null}
    </section>
  );
}

function ChoiceCard(props: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  meta: string;
  price: string;
  description?: string | null;
}) {
  return (
    <label className="group relative flex cursor-pointer items-start gap-4 rounded-2xl border border-line bg-card p-4 transition-[border-color,box-shadow,transform] hover:border-ink/40 active:scale-[0.99] has-[:checked]:border-ink has-[:checked]:shadow-[4px_4px_0_0_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand">
      <input
        type={props.type}
        name={props.name}
        checked={props.checked}
        onChange={props.onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`mt-1 grid size-5 shrink-0 place-items-center border-2 border-ink/30 transition-colors peer-checked:border-brand peer-checked:bg-brand ${
          props.type === "radio" ? "rounded-full" : "rounded-md"
        }`}
      >
        <span className="text-xs leading-none text-brand-ink opacity-0 group-has-[:checked]:opacity-100">
          ✓
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-semibold">{props.title}</span>
          <span className="shrink-0 font-semibold tabular-nums">{props.price}</span>
        </span>
        <span className="block text-sm text-muted">{props.meta}</span>
        {props.description ? (
          <span className="mt-1 block text-sm text-muted">{props.description}</span>
        ) : null}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */

function BarberStep(props: {
  barbers: (Menu["barbers"][number] & { quote: Quote })[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const { barbers } = props;
  const prices = barbers.map((b) => b.quote.priceCents);
  const low = Math.min(...prices);

  return (
    <section aria-labelledby="barber-heading">
      <StepHeading kicker="Who's cutting?">
        <span id="barber-heading">Pick a barber</span>
      </StepHeading>
      <ul className="grid gap-2.5">
        {barbers.length > 1 ? (
          <li className="animate-rise">
            <BarberButton
              onClick={() => props.onSelect(ANY)}
              name="Any barber"
              note="First available"
              price={`from ${formatCents(low)}`}
              initials="✂"
              featured
            />
          </li>
        ) : null}
        {barbers.map((b, i) => (
          <li key={b.id} className="animate-rise" style={rise(i + 1)}>
            <BarberButton
              onClick={() => props.onSelect(b.id)}
              name={b.name}
              note={b.bio ?? `${b.quote.durationMinutes} min`}
              price={formatCents(b.quote.priceCents)}
              initials={b.name.slice(0, 1)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BarberButton(props: {
  onClick: () => void;
  name: string;
  note: string;
  price: string;
  initials: string;
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,box-shadow,transform] hover:shadow-[4px_4px_0_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.99] ${
        props.featured ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink"
      }`}
    >
      <span
        aria-hidden
        className={`grid size-12 shrink-0 place-items-center rounded-full font-display text-2xl font-extrabold uppercase ${
          props.featured ? "bg-brand text-brand-ink" : "bg-paper text-ink ring-1 ring-line"
        }`}
      >
        {props.initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{props.name}</span>
        <span
          className={`block truncate text-sm ${props.featured ? "text-paper/70" : "text-muted"}`}
        >
          {props.note}
        </span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{props.price}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */

function TimeStep(props: {
  slug: string;
  timezone: string;
  serviceIds: string[];
  staffIds: string[];
  source: PublicSource;
  onHeld: (hold: Hold & { staffId: string }) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const today = useMemo(() => shopToday(props.timezone), [props.timezone]);
  const dates = useMemo(() => nextDates(today, DAYS_AHEAD), [today]);

  const results = useQueries({
    queries: props.staffIds.map((staffId) =>
      trpc.booking.availability.queryOptions(
        {
          shopSlug: props.slug,
          staffId,
          serviceIds: props.serviceIds,
          date: today,
          days: DAYS_AHEAD,
        },
        { staleTime: 15_000 },
      ),
    ),
  });
  const loading = results.some((r) => r.isPending);
  const failed = results.every((r) => r.isError);

  const merged = useMemo(
    () =>
      mergeSlots(
        results.flatMap((r, i) => {
          const staffId = props.staffIds[i];
          return r.data && staffId ? [{ staffId, slots: r.data.slots }] : [];
        }),
      ),
    [results, props.staffIds],
  );
  const byDate = useMemo(
    () => groupSlotsByDate([...merged.keys()], props.timezone),
    [merged, props.timezone],
  );

  const [picked, setPicked] = useState<string | null>(null);
  const firstOpen = dates.find((d) => byDate.has(d)) ?? null;
  const date = picked && byDate.has(picked) ? picked : firstOpen;
  const [error, setError] = useState<string | null>(null);

  const hold = useMutation(trpc.booking.hold.mutationOptions());

  const pick = async (slot: string) => {
    setError(null);
    // With "any barber", try each free barber in turn in case one gets taken.
    const candidates = merged.get(slot) ?? [];
    for (const staffId of candidates) {
      try {
        const result = await hold.mutateAsync({
          shopSlug: props.slug,
          staffId,
          serviceIds: props.serviceIds,
          startsAt: slot,
          source: props.source,
        });
        props.onHeld({ ...result, staffId });
        return;
      } catch (e) {
        const code = (e as { data?: { code?: string } }).data?.code;
        if (code !== "CONFLICT") {
          setError("Something went wrong. Please try again.");
          return;
        }
      }
    }
    setError("Someone just grabbed that time. Here's what's still open.");
    await queryClient.invalidateQueries({ queryKey: trpc.booking.availability.pathKey() });
  };

  return (
    <section aria-labelledby="time-heading">
      <StepHeading kicker="When works?">
        <span id="time-heading">Pick a time</span>
      </StepHeading>

      {loading ? (
        <div aria-busy="true" aria-live="polite" className="space-y-4">
          <div className="pole h-2 animate-pole rounded-full" />
          <p className="text-sm text-muted">Checking the book…</p>
        </div>
      ) : failed ? (
        <p role="alert" className="text-danger">
          We couldn&apos;t load times. Please try again.
        </p>
      ) : !firstOpen ? (
        <p className="rounded-2xl border border-line bg-card p-5">
          Nothing open in the next two weeks. Try another barber, or call the shop.
        </p>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label="Date"
            className="-mx-4 mb-6 flex snap-x gap-2 overflow-x-auto px-4 pb-2"
          >
            {dates.map((d) => {
              const open = byDate.has(d);
              const selected = d === date;
              const dt = new Date(`${d}T12:00:00Z`);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!open}
                  onClick={() => setPicked(d)}
                  className={`flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35 ${
                    selected
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-card hover:border-ink"
                  }`}
                >
                  <span className="text-xs font-medium uppercase tracking-wide">
                    {d === today
                      ? "Today"
                      : dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
                  </span>
                  <span className="font-display text-2xl font-extrabold">{dt.getUTCDate()}</span>
                </button>
              );
            })}
          </div>

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
            >
              {error}
            </p>
          ) : null}

          {date ? (
            <div key={date} className="space-y-6">
              <p className="font-serif text-lg">{formatLongDate(`${date}T12:00:00Z`, "UTC")}</p>
              {groupByDayPart(byDate.get(date) ?? [], props.timezone).map((group) => (
                <div key={group.part} className="animate-rise">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                    {group.part}
                  </h3>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {group.slots.map((slot, i) => (
                      <li key={slot} className="animate-rise" style={rise(i)}>
                        <button
                          type="button"
                          disabled={hold.isPending}
                          onClick={() => pick(slot)}
                          className="w-full rounded-xl border border-line bg-card py-3 font-semibold tabular-nums transition-colors hover:border-brand hover:bg-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
                        >
                          {formatTime(slot, props.timezone)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
          {hold.isPending ? (
            <p aria-live="polite" className="mt-6 text-sm text-muted">
              Holding your time…
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!until) return null;
  return Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
}

function Summary({
  menu,
  serviceIds,
  staffId,
  startsAt,
  priceCents,
}: {
  menu: Menu;
  serviceIds: string[];
  staffId: string;
  startsAt: string;
  priceCents: number;
}) {
  const tz = menu.shop.timezone;
  const names = menu.services.filter((s) => serviceIds.includes(s.id)).map((s) => s.name);
  const barber = menu.barbers.find((b) => b.id === staffId)?.name ?? "your barber";
  return (
    <div className="rounded-2xl border border-ink bg-card p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
      <p className="font-display text-3xl font-extrabold uppercase leading-none">
        {formatTime(startsAt, tz)}
        <span className="ml-2 font-serif text-xl font-normal normal-case text-muted">
          with {barber}
        </span>
      </p>
      <p className="mt-1 text-muted">{formatLongDate(startsAt, tz)}</p>
      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-dashed border-line pt-4">
        <p>{names.join(" + ")}</p>
        <p className="font-semibold tabular-nums">{formatCents(priceCents)}</p>
      </div>
    </div>
  );
}

function DetailsStep(props: {
  menu: Menu;
  hold: Hold & { staffId: string };
  serviceIds: string[];
  onExpired: () => void;
  onConfirmed: (c: Confirmed) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const seconds = useCountdown(props.hold.holdExpiresAt);
  const confirm = useMutation(trpc.booking.confirm.mutationOptions());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const expired = seconds === 0;

  // onSubmit rather than a form action: React resets action forms, which would
  // wipe what the client typed when validation fails.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFieldErrors({});
    setFormError(null);
    const email = String(form.get("email") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    try {
      const result = await confirm.mutateAsync({
        appointmentId: props.hold.appointmentId,
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: email || undefined,
        note: note || undefined,
        smsConsent: form.get("smsConsent") === "on",
      });
      await queryClient.invalidateQueries({ queryKey: trpc.booking.availability.pathKey() });
      props.onConfirmed(result);
    } catch (e) {
      const data = (
        e as { data?: { code?: string; zodError?: { fieldErrors?: Record<string, string[]> } } }
      ).data;
      if (data?.code === "PRECONDITION_FAILED") {
        setFormError("Your hold ran out. Pick a time again and we'll hold it for you.");
        return;
      }
      const fe = data?.zodError?.fieldErrors;
      if (fe) {
        setFieldErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0]])));
        return;
      }
      setFormError("Something went wrong. Please try again.");
    }
  };

  const mm =
    seconds === null ? "" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <section aria-labelledby="details-heading">
      <StepHeading kicker="Almost done">
        <span id="details-heading">Your details</span>
      </StepHeading>

      <div className="animate-rise">
        <Summary
          menu={props.menu}
          serviceIds={props.serviceIds}
          staffId={props.hold.staffId}
          startsAt={props.hold.startsAt}
          priceCents={props.hold.priceCents}
        />
        <p className="mt-3 flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <span className="pole inline-block h-2 w-8 animate-pole rounded-full" aria-hidden />
          {expired ? "Your hold has ended." : `Holding this time for ${mm}`}
        </p>
        {props.hold.depositCents > 0 ? (
          <p className="mt-2 text-sm text-muted">Pay at the shop. Nothing is charged now.</p>
        ) : null}
      </div>

      {expired || formError ? (
        <div role="alert" className="mt-6 rounded-xl bg-danger/10 p-4 text-sm text-danger">
          <p className="font-medium">{formError ?? "This time is no longer held."}</p>
          <button
            type="button"
            onClick={props.onExpired}
            className="mt-2 font-semibold underline underline-offset-4"
          >
            Pick a new time
          </button>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <Field label="Name" name="name" autoComplete="name" required error={fieldErrors.name} />
        <Field
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          error={fieldErrors.phone}
          hint="We'll text your confirmation here."
        />
        <Field
          label="Email (optional)"
          name="email"
          type="email"
          autoComplete="email"
          error={fieldErrors.email}
        />
        <div>
          <label htmlFor="note" className="mb-1.5 block font-medium">
            Anything your barber should know?{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={500}
            placeholder="e.g. low fade, keep the length on top"
            className="w-full rounded-xl border border-line bg-card px-4 py-3 outline-none transition-colors placeholder:text-muted/70 focus:border-ink focus-visible:ring-2 focus-visible:ring-brand/40"
          />
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="smsConsent"
            defaultChecked
            className="mt-0.5 size-5 accent-[var(--brand)]"
          />
          <span>
            Text me reminders about this appointment.{" "}
            <span className="text-muted">Message rates may apply. Reply STOP to opt out.</span>
          </span>
        </label>

        <BottomBar>
          <div>
            <p className="text-sm text-muted">Total</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              {formatCents(props.hold.priceCents)}
            </p>
          </div>
          <PrimaryButton type="submit" disabled={confirm.isPending || expired}>
            {confirm.isPending ? "Booking…" : "Confirm booking"}
          </PrimaryButton>
        </BottomBar>
      </form>
    </section>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  inputMode?: "tel" | "email" | "text";
  autoComplete?: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string;
}) {
  const id = `field-${props.name}`;
  const describedBy = props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-medium">
        {props.label}
      </label>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete}
        required={props.required}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-xl border border-line bg-card px-4 py-3 text-lg outline-none transition-colors focus:border-ink focus-visible:ring-2 focus-visible:ring-brand/40 aria-[invalid]:border-danger"
      />
      {props.error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {props.error}
        </p>
      ) : props.hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DoneStep(props: {
  menu: Menu;
  confirmed: Confirmed;
  staffId: string;
  serviceIds: string[];
  onAgain: () => void;
}) {
  const { menu, confirmed } = props;
  const names = menu.services.filter((s) => props.serviceIds.includes(s.id)).map((s) => s.name);
  const barber = menu.barbers.find((b) => b.id === props.staffId)?.name ?? "your barber";

  const ics = buildIcs({
    uid: confirmed.appointmentId,
    title: `${names.join(" + ")} with ${barber}`,
    start: confirmed.startsAt,
    end: confirmed.endsAt,
    location: menu.shop.name,
  });
  const calendarHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;

  return (
    <section aria-labelledby="done-heading" className="pt-4">
      <div className="pole mb-8 h-3 animate-pole rounded-full" aria-hidden />
      <header className="mb-6 animate-rise">
        <p className="font-serif text-2xl text-muted">See you soon.</p>
        <h2
          id="done-heading"
          className="font-display text-6xl font-extrabold uppercase leading-[0.9] tracking-tight"
        >
          You&apos;re booked
        </h2>
      </header>
      <div className="animate-rise" style={rise(2)}>
        <Summary
          menu={menu}
          serviceIds={props.serviceIds}
          staffId={props.staffId}
          startsAt={confirmed.startsAt}
          priceCents={confirmed.priceCents}
        />
      </div>
      <div className="mt-6 flex flex-col gap-3 animate-rise sm:flex-row" style={rise(4)}>
        <a
          href={calendarHref}
          download="appointment.ics"
          className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3.5 font-semibold text-paper transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Add to calendar
        </a>
        <button
          type="button"
          onClick={props.onAgain}
          className="inline-flex items-center justify-center rounded-full border border-ink px-6 py-3.5 font-semibold transition-colors hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Book another
        </button>
      </div>
      {confirmed.depositCents > 0 ? (
        <p className="mt-6 text-sm text-muted">Pay at the shop. Nothing was charged.</p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </div>
    </div>
  );
}

function PrimaryButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className="rounded-full bg-brand px-7 py-3.5 font-semibold text-brand-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[4px_5px_0_0_var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 active:shadow-[1px_1px_0_0_var(--color-ink)] disabled:translate-y-0 disabled:bg-line disabled:text-muted disabled:shadow-none"
    >
      {props.children}
    </button>
  );
}
