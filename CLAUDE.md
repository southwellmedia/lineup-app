# Lineup — working notes for contributors and Claude

Barber-first booking and payments platform. "Lineup" is a working name.
Product plan: booking, payments and branded websites first; shop tools and
the chat agent next; voice AI after that.

## Stack

Architecture follows the MAD Stack shape, but this is its own product.

| Layer                  | Choice                                                       |
| ---------------------- | ------------------------------------------------------------ |
| Web app, booking pages | Next.js App Router, tRPC v11, Tailwind v4 (not started)      |
| Barber app             | Expo (not started)                                           |
| Shop websites          | Astro, multi-tenant templates (not started)                  |
| Database and auth      | Supabase Postgres + Auth, Supabase client SDK, no ORM        |
| Validation             | Zod 4 using the Zod 3 compat API (`import { z } from "zod"`) |
| Payments               | Stripe Connect (not started; cash works today)               |
| Messaging, voice       | Twilio; managed voice platform (later phases)                |
| Monorepo               | pnpm + Turborepo                                             |

## Layout

```
apps/                    # web, barber, sites (not started yet)
packages/scheduling/     # availability engine: pure TS, no I/O
packages/db/             # generated Supabase types + database test suite
supabase/migrations/     # append-only SQL, timestamped (YYYYMMDDHHMMSS_name.sql)
supabase/seed.sql        # local demo shop
```

## Non-negotiables

- **One booking API.** The web, barber app, chat agent and voice agent all book
  through the same server procedures. Business rules live there and in the
  database, never in a client.
- **The database prevents double-booking.** `appointments_no_overlap` is an
  exclusion constraint on (staff, [starts_at, blocked_until)). Never work
  around it; handle error `LU409` as "slot taken".
- **Appointments are created only by `create_appointment`**, and holds become
  bookings only through `confirm_hold`. These run as service_role. The API
  checks availability first with `@lineup/scheduling`'s `isSlotAvailable`.
- **Money is integer cents** (`*_cents integer`). This deliberately differs
  from ReapOS's `NUMERIC(10,2)`: Stripe works in cents and integers avoid
  float drift in JS. Format as currency only in the UI.
- **The payments ledger is immutable.** Refunds and corrections are new rows
  (`kind = 'refund'`, negative amounts, `refunds_payment_id` set). A trigger
  rejects UPDATE and DELETE.
- **Cash first, card later.** `record_manual_payment` marks a booking paid for
  `cash` or `external` (Cash App, Zelle and so on). Card rows come only from
  Stripe webhooks and must carry a `payment_account_id` and a Stripe intent id.
- **Who gets paid is undecided.** `payment_accounts` belong to either the shop
  (`staff_id` null) or one barber, so "shop collects" and "booth renter is
  paid directly" both work. Don't hard-code either model.
- **Record attribution on every booking.** `source` is where the client came
  from (the zero-commission promise depends on it); `booked_by` is who or what
  created the booking.
- **Times are UTC `timestamptz`.** Working hours are local wall-clock times,
  resolved in the shop's IANA timezone. Test DST changes for anything
  involving time.

## Tenancy and security

- The tenant is `shop_id`. A solo barber is a shop on the `solo` plan with one
  staff member.
- Access comes from `staff` membership (`private.is_shop_member`,
  `private.is_shop_manager`, `private.my_staff_id`), not from a JWT org claim,
  because one person can belong to several shops (e.g. a booth renter with
  their own solo shop).
- Owners and managers see the whole shop. Barbers see their own appointments
  and payments, plus clients they have served or who prefer them (unless
  `share_clients_between_staff` is on).
- Clients never have accounts. Anonymous visitors get no table access; public
  booking goes through the server.
- Every new table needs RLS policies and a test in `packages/db/test/rls.test.ts`.
- Supabase grants EXECUTE to `anon`/`authenticated` by default, so a function
  meant only for the server must `REVOKE ... FROM PUBLIC, anon, authenticated`.

## Database error codes

| Code    | Meaning                                                         |
| ------- | --------------------------------------------------------------- |
| `LU404` | Not found, or not bookable (inactive barber, unoffered service) |
| `LU409` | Slot no longer available                                        |
| `LU410` | Hold expired                                                    |
| `LU422` | Invalid request or state transition                             |

## Supabase project

Hosted project `lineup-app` (ref `njrnucsrbxwtomnhcavs`, Postgres 17). Every
migration in `supabase/migrations` has been applied to it, and the Supabase
security advisor reports no issues. `.mcp.json` configures the Supabase MCP
server for this project. Copy `.env.example` to `.env.local` for app keys;
never commit secrets.

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test            # needs Postgres 15+ with btree_gist; see DATABASE_URL below
pnpm format
pnpm db:types              # regenerate packages/db/src/database.types.ts (needs `supabase login`)
pnpm exec supabase start   # full local Supabase (needs Docker)
```

Database tests run against any Postgres 15+ server. They build a migrated
template database once, then clone it for each test file. Set `DATABASE_URL`
(default `postgres://postgres:postgres@localhost:5432/postgres`). On plain
Postgres, `packages/db/test/supabase-shim.sql` provides `auth.users`,
`auth.uid()` and the Supabase roles.

## Conventions

- Migrations are append-only. Never edit one that has been applied to the
  hosted project; add a new file. Name new files with `supabase migration new
<name>` so versions match what Supabase records. After a schema change, run
  `pnpm db:types` and commit the regenerated types.
- Commits use `type(scope): description` (`feat`, `fix`, `refactor`, `chore`,
  `docs`, `test`).
- TypeScript is strict with `noUncheckedIndexedAccess`. No `any`.
