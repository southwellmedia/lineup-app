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

Next up: the Next.js app with the tRPC booking API, then the public booking page.

## Getting started

Requirements: Node 22+, pnpm 10, and Postgres 15+ for the database tests.

```bash
pnpm install
pnpm typecheck
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test
```

To run the full Supabase stack locally (needs Docker):

```bash
pnpm exec supabase start   # applies migrations and seed.sql
```

See [CLAUDE.md](./CLAUDE.md) for architecture rules and conventions.
