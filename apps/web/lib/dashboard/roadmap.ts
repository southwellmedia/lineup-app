/**
 * Dashboard sections that are designed but not built yet. They show in the
 * nav with a "Soon" tag and open a page describing what's coming, so the
 * product's shape is visible without shipping empty screens. When one is
 * built, give it a real route (static routes win over [feature]) and
 * remove it here.
 */
export type PlannedFeature = {
  id: string;
  label: string;
  title: string;
  pitch: string;
  points: string[];
  /** What already works today, if anything. */
  today?: string;
  managersOnly: boolean;
};

export const PLANNED: Record<string, PlannedFeature> = {
  "walk-ins": {
    id: "walk-ins",
    label: "Walk-ins",
    title: "Walk-in line",
    pitch: "A live line with honest wait times, so walk-ins don't walk out.",
    points: [
      "Quoted wait that updates as chairs free up",
      "Clients join at the door, by text, or through the voice agent",
      "A text when they're second in line, so they can step out",
      '"Seat next" matches the next client with the first free barber',
      "A lobby TV screen with first names or the last four digits only",
    ],
    today: "Walk-ins can be added on the calendar and checked straight in.",
    managersOnly: false,
  },
  payments: {
    id: "payments",
    label: "Payments",
    title: "Payments",
    pitch: "Card payments, deposits and payouts, with every fee itemized.",
    points: [
      "Card payments and tips through Stripe, paid out daily",
      "Deposits at booking, kept automatically on no-shows",
      "Refunds and corrections as new ledger rows, never edits",
      "Pay the shop or pay each barber directly (booth renters)",
      "Monthly statements you can download",
    ],
    today: "Cash and other payments (Cash App, Zelle) are recorded on each appointment.",
    managersOnly: false,
  },
  "booth-rent": {
    id: "booth-rent",
    label: "Booth rent",
    title: "Booth rent & commission",
    pitch: "Collect chair rent and settle commission without chasing anyone.",
    points: [
      "Weekly or monthly rent per booth renter, with autopay",
      "Pay-link texts and late reminders on your schedule",
      "Commission splits for services, products and tips",
      "A payroll report for each period",
    ],
    managersOnly: true,
  },
  reports: {
    id: "reports",
    label: "Reports",
    title: "Reports",
    pitch: "How the shop is really doing, per barber and per week.",
    points: [
      "Revenue, tips and average ticket per barber",
      "Rebooking rate, regulars past their usual cadence and no-show rate",
      "Busiest hours and open time worth filling",
      "Where clients come from, and what they're worth",
      "CSV exports for your accountant",
    ],
    today: "Website visits and bookings by source are on the Website page.",
    managersOnly: true,
  },
  "ai-agents": {
    id: "ai-agents",
    label: "AI agents",
    title: "AI agents",
    pitch: "A receptionist that answers texts, DMs and calls, and books through Lineup.",
    points: [
      "Chat agent for texts, Instagram DMs and website chat",
      "Voice agent that picks up after a few rings or after hours",
      "Books, moves and cancels using your real availability and prices",
      "Your rules: which services, which clients need your OK, quiet hours",
      'Anything it can\'t handle lands in your "Needs you" list',
    ],
    managersOnly: true,
  },
};

export const isPlanned = (id: string) => Object.hasOwn(PLANNED, id);
