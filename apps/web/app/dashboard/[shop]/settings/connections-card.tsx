"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useShop } from "@/components/shop-context";
import { Button, Card, CardTitle, Field, fieldErrors, Input, Notice } from "@/components/ui";
import { useTRPC } from "@/trpc/client";

/** Google Analytics, Meta Pixel and Search Console for the shop's website. */
export function ConnectionsCard() {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.settings.get.queryOptions({ shopId: shop.id }));

  const [form, setForm] = useState({
    ga4: data.ga4_measurement_id ?? "",
    metaPixel: data.meta_pixel_id ?? "",
    siteVerification: data.google_site_verification ?? "",
  });
  const [saved, setSaved] = useState(false);
  const save = useMutation(
    trpc.settings.updateConnections.mutationOptions({
      onSuccess: async (shopRow) => {
        // Show the cleaned-up values (an id pulled out of a pasted snippet).
        setForm({
          ga4: shopRow.ga4_measurement_id ?? "",
          metaPixel: shopRow.meta_pixel_id ?? "",
          siteVerification: shopRow.google_site_verification ?? "",
        });
        setSaved(true);
        await queryClient.invalidateQueries({ queryKey: trpc.settings.get.pathKey() });
      },
    }),
  );
  const errors = fieldErrors(save.error);

  const set = (key: keyof typeof form, value: string) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ shopId: shop.id, ...form });
  };

  const connected = [
    data.ga4_measurement_id,
    data.meta_pixel_id,
    data.google_site_verification,
  ].filter(Boolean).length;

  return (
    <Card id="connections" className="mt-5 scroll-mt-6">
      <CardTitle
        action={
          <span className="text-sm font-semibold text-muted">
            {connected ? `${connected} connected` : "None yet"}
          </span>
        }
      >
        Connections
      </CardTitle>
      <p className="mb-5 max-w-prose text-sm text-muted">
        Already use Google Analytics or run Instagram and Facebook ads? Add your IDs and your
        website loads them on every page. Lineup&apos;s own visitor stats on the Website page work
        without any of this. You can paste the whole snippet; we&apos;ll pull out the ID.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <Field
          label="Google Analytics 4 measurement ID"
          htmlFor="c-ga4"
          error={errors.ga4}
          hint="Google Analytics → Admin → Data streams → your web stream. Starts with G-."
        >
          <Input
            id="c-ga4"
            value={form.ga4}
            placeholder="G-AB12CD34EF"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => set("ga4", e.target.value)}
          />
        </Field>

        <Field
          label="Meta Pixel ID"
          htmlFor="c-pixel"
          error={errors.metaPixel}
          hint="Meta Events Manager → Data sources → your pixel. Lets Instagram and Facebook ads see site visits and Book clicks."
        >
          <Input
            id="c-pixel"
            value={form.metaPixel}
            placeholder="123456789012345"
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => set("metaPixel", e.target.value)}
          />
        </Field>

        <Field
          label="Google Search Console verification"
          htmlFor="c-verify"
          error={errors.siteVerification}
          hint="Search Console → Add property → URL prefix → HTML tag. Paste the tag, save here, then press Verify in Search Console."
        >
          <Input
            id="c-verify"
            value={form.siteVerification}
            placeholder='<meta name="google-site-verification" content="…" />'
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => set("siteVerification", e.target.value)}
          />
        </Field>

        <p className="rounded-xl bg-paper px-4 py-3 text-sm text-muted ring-1 ring-line">
          Google Analytics and the Meta Pixel set cookies on your visitors. If you get clients from
          the EU or California, check what consent you need before turning them on.
        </p>

        {save.error && !Object.values(errors).some(Boolean) ? (
          <Notice tone="error">{save.error.message}</Notice>
        ) : null}
        {saved ? (
          <Notice tone="success">Saved. Your website picks this up within a minute.</Notice>
        ) : null}

        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save connections"}
        </Button>
      </form>
    </Card>
  );
}
