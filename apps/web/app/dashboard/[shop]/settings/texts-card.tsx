"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useShop } from "@/components/shop-context";
import { Badge, Button, Card, CardTitle, Notice, Switch } from "@/components/ui";
import { useTRPC } from "@/trpc/client";

/** Booking confirmations and reminders by text. */
export function TextsCard() {
  const trpc = useTRPC();
  const shop = useShop();
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(trpc.settings.get.queryOptions({ shopId: shop.id }));
  const { data: stats } = useSuspenseQuery(trpc.settings.texts.queryOptions({ shopId: shop.id }));

  const [form, setForm] = useState({
    enabled: settings.sms_enabled,
    reminder24h: settings.sms_reminder_24h,
    reminder2h: settings.sms_reminder_2h,
  });
  const [saved, setSaved] = useState(false);
  const save = useMutation(
    trpc.settings.updateTexts.mutationOptions({
      onSuccess: async () => {
        setSaved(true);
        await queryClient.invalidateQueries({ queryKey: trpc.settings.get.pathKey() });
      },
    }),
  );
  const set = (key: keyof typeof form, value: boolean) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <Card id="texts" className="mt-5 scroll-mt-6">
      <CardTitle
        action={
          stats.twilioReady ? <Badge tone="ink">On</Badge> : <Badge tone="muted">Coming soon</Badge>
        }
      >
        Text messages
      </CardTitle>
      <p className="mb-5 max-w-prose text-sm text-muted">
        Clients who agree to texts get a confirmation when they book and reminders before their
        visit. They can reply <strong>C</strong> to confirm, <strong>X</strong> to cancel (outside
        your cancellation window) or <strong>STOP</strong> to opt out.
      </p>

      {stats.twilioReady ? (
        <p className="mb-5 text-sm text-muted">
          Last 30 days: {stats.sent} sent
          {stats.failed ? `, ${stats.failed} failed` : ""}, {stats.received} replies.
        </p>
      ) : (
        <p className="mb-5 rounded-xl bg-paper px-4 py-3 text-sm text-muted ring-1 ring-line">
          <span className="font-semibold text-ink">Texting is almost ready.</span> Lineup is
          finishing carrier registration for its texting number. Choose your settings now and
          they&apos;ll apply as soon as texts go live; nothing to set up on your side.
        </p>
      )}

      <div className="space-y-4">
        <Switch
          id="t-enabled"
          checked={form.enabled}
          onChange={(v) => set("enabled", v)}
          label="Text clients"
          description="Send a confirmation as soon as a booking is made."
        />
        <Switch
          id="t-24h"
          checked={form.enabled && form.reminder24h}
          onChange={(v) => set("reminder24h", v)}
          label="Reminder the day before"
          description="About 24 hours ahead, for bookings made more than a day out."
        />
        <Switch
          id="t-2h"
          checked={form.enabled && form.reminder2h}
          onChange={(v) => set("reminder2h", v)}
          label="Reminder 2 hours before"
          description="Optional. Each reminder is another text, and the day-before one covers most no-shows."
        />
      </div>

      <div className="mt-5 space-y-3">
        {save.error ? <Notice tone="error">{save.error.message}</Notice> : null}
        {saved ? <Notice tone="success">Saved.</Notice> : null}
        <Button
          variant="primary"
          disabled={save.isPending}
          onClick={() => save.mutate({ shopId: shop.id, ...form })}
        >
          {save.isPending ? "Saving…" : "Save text settings"}
        </Button>
      </div>
    </Card>
  );
}
