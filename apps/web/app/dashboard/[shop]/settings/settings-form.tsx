"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useShop } from "@/components/shop-context";
import {
  Button,
  Card,
  CardTitle,
  Field,
  fieldErrors,
  Input,
  MoneyInput,
  Notice,
  PageHeader,
  Select,
  Switch,
  Textarea,
  toCents,
} from "@/components/ui";
import { formatPhone } from "@/lib/dashboard/summary";
import { brandStyle, DEFAULT_BRAND } from "@lineup/site-kit";
import { slugify } from "@/lib/shop/slug";
import { useTRPC } from "@/trpc/client";

const TIMEZONES = [
  ["America/Chicago", "Central (Dallas, Houston)"],
  ["America/New_York", "Eastern"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
] as const;

const SWATCHES = [
  "#C0312B",
  "#1D4ED8",
  "#0F766E",
  "#B45309",
  "#7C3AED",
  "#BE185D",
  "#1C1714",
  "#CA8A04",
];

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function SettingsForm() {
  const trpc = useTRPC();
  const shop = useShop();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.settings.get.queryOptions({ shopId: shop.id }));
  const update = useMutation(trpc.settings.update.mutationOptions());

  const [form, setForm] = useState({
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    brandColor: data.brand_color ?? DEFAULT_BRAND,
    noticeHours: String(data.min_booking_notice_minutes / 60),
    advanceDays: String(data.max_booking_advance_days),
    slotInterval: String(data.slot_interval_minutes),
    cancelHours: String(data.cancellation_window_minutes / 60),
    lateCancelFee: dollars(data.late_cancel_fee_cents),
    noShowFee: dollars(data.no_show_fee_cents),
    shareClients: data.share_clients_between_staff,
    tagline: data.tagline ?? "",
    about: data.about ?? "",
    phone: data.phone ? formatPhone(data.phone) : "",
    email: data.email ?? "",
    instagram: data.instagram ?? "",
    addressLine: data.address_line ?? "",
    city: data.city ?? "",
    region: data.region ?? "",
    postalCode: data.postal_code ?? "",
    neighborhood: data.neighborhood ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setMessage(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const bookingPath = `/book/${form.slug}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setMessage(null);
    const lateCancel = toCents(form.lateCancelFee);
    const noShow = toCents(form.noShowFee);
    if (lateCancel === null || noShow === null) {
      setErrors({
        lateCancelFeeCents: lateCancel === null ? "Enter an amount like 10" : undefined,
        noShowFeeCents: noShow === null ? "Enter an amount like 20" : undefined,
      });
      return;
    }
    try {
      const saved = await update.mutateAsync({
        shopId: shop.id,
        name: form.name,
        slug: form.slug,
        timezone: form.timezone,
        brandColor: form.brandColor.toUpperCase() === DEFAULT_BRAND ? null : form.brandColor,
        minBookingNoticeMinutes: Math.round(Number(form.noticeHours) * 60),
        maxBookingAdvanceDays: Number(form.advanceDays),
        slotIntervalMinutes: Number(form.slotInterval),
        cancellationWindowMinutes: Math.round(Number(form.cancelHours) * 60),
        lateCancelFeeCents: lateCancel,
        noShowFeeCents: noShow,
        shareClientsBetweenStaff: form.shareClients,
        tagline: form.tagline,
        about: form.about,
        phone: form.phone,
        email: form.email,
        instagram: form.instagram,
        addressLine: form.addressLine,
        city: form.city,
        region: form.region,
        postalCode: form.postalCode,
        neighborhood: form.neighborhood,
      });
      await queryClient.invalidateQueries({ queryKey: trpc.settings.pathKey() });
      if (saved.slug !== shop.slug) {
        // The dashboard URL uses the slug, so move to the new one.
        router.replace(`/dashboard/${saved.slug}/settings` as Route);
      } else {
        router.refresh();
      }
      setMessage({ tone: "success", text: "Settings saved." });
    } catch (e) {
      const fe = fieldErrors(e);
      if (Object.keys(fe).length) setErrors(fe);
      else setMessage({ tone: "error", text: (e as Error).message });
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader kicker={shop.name} title="Settings" />
      <div className="space-y-6">
        <Card>
          <CardTitle>Shop</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shop name" htmlFor="s-name" error={errors.name}>
              <Input id="s-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Timezone" htmlFor="s-tz" error={errors.timezone}>
              <Select
                id="s-tz"
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              >
                {TIMEZONES.some(([tz]) => tz === form.timezone) ? null : (
                  <option value={form.timezone}>{form.timezone}</option>
                )}
                {TIMEZONES.map(([tz, label]) => (
                  <option key={tz} value={tz}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Booking link"
              htmlFor="s-slug"
              error={errors.slug}
              hint="Put this in your Instagram bio. Changing it breaks links you've already shared."
              className="sm:col-span-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-card pl-3.5 focus-within:border-ink">
                  <span className="shrink-0 text-muted">/book/</span>
                  <input
                    id="s-slug"
                    value={form.slug}
                    onChange={(e) =>
                      set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                    }
                    onBlur={() => set("slug", slugify(form.slug))}
                    className="w-full min-w-0 bg-transparent py-2.5 pr-3 outline-none"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}${bookingPath}?src=instagram`,
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Copied!" : "Copy Instagram link"}
                </Button>
                <a
                  href={bookingPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold underline underline-offset-4"
                >
                  Open
                </a>
              </div>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Contact &amp; location</CardTitle>
          <p className="-mt-2 mb-4 text-sm text-muted">
            Shown on your website and booking page, and used for Google.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tagline"
              htmlFor="s-tagline"
              error={errors.tagline}
              className="sm:col-span-2"
            >
              <Input
                id="s-tagline"
                maxLength={120}
                value={form.tagline}
                onChange={(e) => set("tagline", e.target.value)}
                placeholder="Sharp fades. No waiting around."
              />
            </Field>
            <Field label="About" htmlFor="s-about" error={errors.about} className="sm:col-span-2">
              <Textarea
                id="s-about"
                rows={3}
                maxLength={2000}
                value={form.about}
                onChange={(e) => set("about", e.target.value)}
                placeholder="Who you are, how long you've been cutting, what you're known for."
              />
            </Field>
            <Field label="Shop phone" htmlFor="s-phone" error={errors.phone}>
              <Input
                id="s-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="Instagram" htmlFor="s-ig" error={errors.instagram}>
              <div className="flex items-center rounded-xl border border-line bg-card pl-3.5 focus-within:border-ink">
                <span className="text-muted">@</span>
                <input
                  id="s-ig"
                  value={form.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  className="w-full bg-transparent py-2.5 pl-0.5 pr-3 outline-none"
                />
              </div>
            </Field>
            <Field label="Email (public)" htmlFor="s-email" error={errors.email}>
              <Input
                id="s-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field
              label="Neighborhood"
              htmlFor="s-hood"
              error={errors.neighborhood}
              hint="Used in your site's local search text."
            >
              <Input
                id="s-hood"
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
                placeholder="Oak Cliff"
              />
            </Field>
            <Field
              label="Street address"
              htmlFor="s-addr"
              error={errors.addressLine}
              className="sm:col-span-2"
            >
              <Input
                id="s-addr"
                value={form.addressLine}
                onChange={(e) => set("addressLine", e.target.value)}
              />
            </Field>
            <Field label="City" htmlFor="s-city" error={errors.city}>
              <Input id="s-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State" htmlFor="s-region" error={errors.region}>
                <Input
                  id="s-region"
                  value={form.region}
                  onChange={(e) => set("region", e.target.value)}
                />
              </Field>
              <Field label="ZIP" htmlFor="s-zip" error={errors.postalCode}>
                <Input
                  id="s-zip"
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>Brand color</CardTitle>
          <p className="-mt-2 mb-4 text-sm text-muted">
            Used for buttons and accents on your booking page.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use ${c}`}
                aria-pressed={form.brandColor.toUpperCase() === c}
                onClick={() => set("brandColor", c)}
                className="size-9 rounded-full ring-offset-2 ring-offset-card aria-pressed:ring-2 aria-pressed:ring-ink focus-visible:outline-2 focus-visible:outline-brand"
                style={{ backgroundColor: c }}
              />
            ))}
            <label className="ml-2 flex items-center gap-2 text-sm font-semibold">
              Custom
              <input
                type="color"
                value={form.brandColor}
                onChange={(e) => set("brandColor", e.target.value.toUpperCase())}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-card"
              />
            </label>
          </div>
          <div
            className="mt-5 flex items-center gap-3 rounded-xl bg-paper p-4"
            style={brandStyle(form.brandColor)}
          >
            <span className="pole h-10 w-3 rounded-full ring-2 ring-ink" aria-hidden />
            <span className="rounded-full bg-brand px-6 py-3 font-semibold text-brand-ink shadow-[3px_3px_0_0_var(--color-ink)]">
              Confirm booking
            </span>
            <span className="text-sm text-muted">Preview</span>
          </div>
        </Card>

        <Card>
          <CardTitle>Booking rules</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Minimum notice (hours)"
              htmlFor="s-notice"
              error={errors.minBookingNoticeMinutes}
              hint="How soon before a slot clients can book it."
            >
              <Input
                id="s-notice"
                type="number"
                min={0}
                step={0.5}
                value={form.noticeHours}
                onChange={(e) => set("noticeHours", e.target.value)}
              />
            </Field>
            <Field
              label="Book up to (days ahead)"
              htmlFor="s-advance"
              error={errors.maxBookingAdvanceDays}
            >
              <Input
                id="s-advance"
                type="number"
                min={1}
                max={365}
                value={form.advanceDays}
                onChange={(e) => set("advanceDays", e.target.value)}
              />
            </Field>
            <Field
              label="Time slots every"
              htmlFor="s-interval"
              error={errors.slotIntervalMinutes}
              hint="Clients can also book right when a cut ends."
            >
              <Select
                id="s-interval"
                value={form.slotInterval}
                onChange={(e) => set("slotInterval", e.target.value)}
              >
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Free cancellation until (hours before)"
              htmlFor="s-cancel"
              error={errors.cancellationWindowMinutes}
            >
              <Input
                id="s-cancel"
                type="number"
                min={0}
                step={1}
                value={form.cancelHours}
                onChange={(e) => set("cancelHours", e.target.value)}
              />
            </Field>
            <Field label="Late cancellation fee" htmlFor="s-late" error={errors.lateCancelFeeCents}>
              <MoneyInput
                id="s-late"
                value={form.lateCancelFee}
                onChange={(e) => set("lateCancelFee", e.target.value)}
              />
            </Field>
            <Field
              label="No-show fee"
              htmlFor="s-noshow"
              error={errors.noShowFeeCents}
              hint="Charged automatically once card payments are on."
            >
              <MoneyInput
                id="s-noshow"
                value={form.noShowFee}
                onChange={(e) => set("noShowFee", e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Client privacy</CardTitle>
          <Switch
            id="s-share"
            checked={form.shareClients}
            onChange={(v) => set("shareClients", v)}
            label="Share clients between barbers"
            description="Off: barbers only see clients they've cut or who prefer them. Owners and managers always see everyone."
          />
        </Card>

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <div className="sticky bottom-20 z-10 md:bottom-4">
          <Button type="submit" variant="primary" disabled={update.isPending} className="shadow-lg">
            {update.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </form>
  );
}
