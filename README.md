# Lineup

A barber-first booking and payments platform: "Your clients. Your brand. Your money."
("Lineup" is a working name.)

## Status

This first slice sets up the foundation the plan asks for before any UI:

- **Schema** (`supabase/migrations`): shops, staff, services with per-barber
  overrides, working hours, time off, clients, appointments, a payments
  ledger and row-level security.
- **Double-booking prevention** enforced by Postgres, including under
  concurrent requests, with short-lived slot holds for checkout.
- **Cash payments**: mark a booking paid in cash or off-platform (Cash App,
  Zelle, etc.), including split payments, tips and refunds. The schema is
  ready for Stripe card payments landing in either the shop's or a barber's
  account.
- **Availability engine** (`packages/scheduling`): turns working hours,
  bookings and time off into bookable slots, and handles daylight-saving
  changes correctly.

The schema is live on the hosted Supabase project, and typed access is
available from `@lineup/db`.

The web app (`apps/web`) has:

- **Client booking** at `/book/<shop-slug>`: service, barber (or any),
  time, details, confirmation with add-to-calendar.
- **Admin** at `/dashboard` (magic-link sign-in at `/login`):
  - **Today:** the day's book, totals, check-in with a live "in the chair"
    timer, mark paid (cash or other, with tip), no-show and cancel.
  - **Calendar:** full-width day view (a column per barber) and week view,
    with working hours, breaks and time off. Drag bookings to another time
    or barber (with undo), click empty time to book phone calls and
    walk-ins, and open any booking for a detail panel: client history and
    notes, live chair timer, prices and payment, check in, take payment,
    no-show, move, cancel, book again.
  - **Clients:** search, profiles with history, notes, add client, CSV export.
  - **Services:** menu, add-ons, prices, durations, deposits, per-barber
    pricing, ordering.
  - **Team:** invite by email, roles, weekly hours with breaks, time off.
  - **Website → Design:** pick a template (Classic, or the premium Contact
    Sheet), switch sections on and off, drag to reorder, edit their copy and
    photos, and see it in a live desktop/phone preview before publishing.
  - **Website:** cookie-free analytics (visitors, Book clicks, the funnel
    to bookings and booked value, top pages, referrers, bookings by
    source), the shop's site link, a live desktop/phone preview, and a
    checklist of what the site is missing.
  - **Settings → Text messages:** booking confirmations, day-before and
    optional 2-hour reminders by text; clients reply C to confirm, X to
    cancel, STOP to opt out. The appointment panel shows each text sent.
    Lineup sends from its own Twilio account (see "Turning on texts").
  - **Settings:** Connections (Google Analytics 4, Meta Pixel, Search Console
    verification for the shop's site), name, booking link, timezone, brand color, booking rules.
    Owners and managers see everything; barbers see their chair and hours.

Lineup's own team gets a super admin panel at `/admin`: every shop with its
owner, plan and 30-day activity; plan and premium-template switches;
suspending a shop (booking page, website and texts go offline, nothing is
deleted); and an append-only audit log of every change.

Shop websites (`apps/sites`, Astro) render each shop's site from the public
site API (`/api/public/sites/<slug>`): home page with menu, barbers, hours
and map link; a page per service and barber; sitemap, robots and
HairSalon JSON-LD. Every "Book" button deep-links into the booking flow with
the service or barber preselected and `src=website`. Locally the site lives at
`http://localhost:4321/<shop-slug>`; in production it also resolves
`<slug>.<SITES_ROOT_DOMAIN>` and custom domains.

Next up: Stripe Connect card payments, then the social app (Instagram posting).

## Turning on texts

Texts come from Lineup's Twilio account, not the shops'. Until it's set up,
every text is logged as `skipped`.

1. Buy a toll-free number in Twilio and submit toll-free verification
   (use case: appointment confirmations and reminders on behalf of shops).
2. On the `lineup-web` Vercel project, add `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN` and `TWILIO_FROM` (sensitive), then redeploy.
3. Set the number's "A message comes in" webhook to
   `https://<web app domain>/api/webhooks/twilio` (HTTP POST).

Reminders already run: a Supabase cron job calls `/api/cron/reminders` every
15 minutes with the `CRON_SECRET` stored in Supabase Vault.

## Getting started

Requirements: Node 22+, pnpm 10, and Postgres 15+ for the database tests.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then add SUPABASE_SECRET_KEY
pnpm dev                                       # http://localhost:3000/book/southside-cuts
pnpm typecheck
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test
```

To run the full Supabase stack locally (needs Docker):

```bash
pnpm exec supabase start   # applies migrations and seed.sql
```

See [CLAUDE.md](./CLAUDE.md) for architecture rules and conventions.
