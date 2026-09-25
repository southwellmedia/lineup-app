"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useShop } from "@/components/shop-context";
import { Badge, Button, Card, CardTitle, Notice, Switch } from "@/components/ui";
import { useTRPC } from "@/trpc/client";

/** Booking confirmations and reminders by text. */
export function TextsCard({ webhookUrl }: { webhookUrl: string }) {
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
          stats.twilioReady ? (
            <Badge tone="ink">Connected</Badge>
          ) : (
            <Badge tone="muted">Not connected</Badge>
          )
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
        <div className="mb-5 rounded-xl bg-paper px-4 py-3 text-sm ring-1 ring-line">
          <p className="font-semibold">Texts aren&apos;t sending yet</p>
          <p className="mt-1 text-muted">
            Lineup needs a Twilio account and number. Until then, texts are logged as skipped
            {stats.skipped ? ` (${stats.skipped} in the last 30 days)` : ""}. To connect:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            <li>Create a Twilio account and buy a local number.</li>
            <li>
              Register it for A2P 10DLC (Twilio → Messaging → Regulatory compliance). US carriers
              block unregistered business texts.
            </li>
            <li>
              Add <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> and{" "}
              <code>TWILIO_FROM</code> to the web app&apos;s environment.
            </li>
            <li>
              Point the number&apos;s &quot;A message comes in&quot; webhook at{" "}
              <code className="break-all">{webhookUrl}</code>.
            </li>
          </ol>
        </div>
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
          description="For bookings made more than 3 hours ahead."
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
