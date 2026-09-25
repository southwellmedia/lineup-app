"use client";

import { Plus, Bell, Download } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardTitle,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Input,
  MoneyInput,
  Notice,
  PageHeader,
  Segmented,
  Select,
  SoonBadge,
  StatCard,
  Switch,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";

const COLORS = [
  ["paper", "Canvas"],
  ["card", "Card"],
  ["ink", "Ink"],
  ["muted", "Muted"],
  ["line", "Line"],
  ["brand", "Lineup yellow"],
  ["sidebar", "Sidebar"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Danger"],
] as const;

export function Gallery() {
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [on, setOn] = useState(true);
  const [chip, setChip] = useState("all");

  return (
    <>
      <PageHeader
        kicker="Design system"
        title="UI kit"
        description="The shared pieces in components/ui.tsx. Build screens from these."
        action={
          <>
            <IconButton label="Notifications">
              <Bell />
            </IconButton>
            <Button>
              <Download />
              Secondary
            </Button>
            <Button variant="primary">
              <Plus />
              Primary
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Colors">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {COLORS.map(([token, label]) => (
              <li key={token} className="text-xs">
                <span
                  className="mb-1 block h-10 rounded-lg ring-1 ring-line"
                  style={{ background: `var(--color-${token})` }}
                />
                <span className="font-semibold">{label}</span>
                <span className="block text-muted">{token}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type">
          <p className="text-3xl font-bold tracking-tight">Page title</p>
          <p className="text-[1.0625rem] font-semibold tracking-tight">Card title</p>
          <p>Body text in Geist. Numbers use tabular figures: 10:45 · $1,284.50</p>
          <p className="text-sm text-muted">Muted supporting text</p>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="dark">Dark</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary">
              Small
            </Button>
            <Button size="sm">Small</Button>
          </div>
        </Section>

        <Section title="Badges, chips, avatars">
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="brand">Brand</Badge>
            <Badge tone="ink">Ink</Badge>
            <Badge tone="success">Paid</Badge>
            <Badge tone="warning">Due Fri</Badge>
            <Badge tone="danger">2 days late</Badge>
            <Badge tone="muted">Muted</Badge>
            <SoonBadge />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["all", "Marcus", "Dre"].map((c) => (
              <Chip key={c} active={chip === c} onClick={() => setChip(c)}>
                {c === "all" ? "All barbers" : c}
              </Chip>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Avatar name="Marcus Hill" size="lg" />
            <Avatar name="Dre" color="#2563eb" />
            <Avatar name="Luis" color="#16a34a" />
            <Avatar name="Tony" tone="brand" size="sm" />
          </div>
          <Segmented
            className="mt-3"
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
        </Section>

        <Section title="Forms">
          <div className="space-y-4">
            <Field label="Client name" htmlFor="kit-name" hint="First and last name.">
              <Input id="kit-name" placeholder="Mike L." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Service" htmlFor="kit-service">
                <Select id="kit-service" defaultValue="fade">
                  <option value="fade">Skin fade · 45m</option>
                  <option value="lineup">Lineup · 20m</option>
                </Select>
              </Field>
              <Field label="Price" htmlFor="kit-price">
                <MoneyInput id="kit-price" defaultValue="35.00" />
              </Field>
            </div>
            <Field label="Note" htmlFor="kit-note" error="Keep it under 500 characters.">
              <Textarea id="kit-note" aria-invalid />
            </Field>
            <Switch
              id="kit-switch"
              checked={on}
              onChange={setOn}
              label="Text a confirmation"
              description="With a link to change or cancel"
            />
          </div>
        </Section>

        <Section title="Feedback">
          <div className="space-y-3">
            <Notice tone="success">Saved. Your website picks this up within a minute.</Notice>
            <Notice tone="error">That slot was just taken. Pick another time.</Notice>
            <EmptyState title="No bookings yet">Share your booking link to get started.</EmptyState>
          </div>
        </Section>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Booked today" value="38" hint="22 done · 16 to go" />
        <StatCard label="Card volume" value="$1,642" hint="+$140 cash tips" />
        <StatCard label="Open slots" value="3" hint="Waitlist filling 1" />
        <StatCard label="Payout tonight" value="$1,284.50" hint="$0 commission" tone="dark" />
      </div>

      <div className="mt-5">
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Entry</Th>
              <Th>Client</Th>
              <Th>Source</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {[
              ["2:41 PM", "Fade + beard · tip $9", "Kevin R.", "Website", "+$54.00"],
              ["1:30 PM", "No-show · deposit kept", "Tre B.", "Instagram", "+$10.00"],
            ].map(([time, entry, client, source, amount]) => (
              <tr key={time}>
                <Td className="text-muted">{time}</Td>
                <Td>{entry}</Td>
                <Td className="font-semibold">{client}</Td>
                <Td>
                  <Badge>{source}</Badge>
                </Td>
                <Td className="text-right font-semibold tabular-nums">{amount}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {children}
    </Card>
  );
}
