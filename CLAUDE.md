# Lineup — working notes for contributors and Claude

Barber-first booking and payments platform. "Lineup" is a working name.
Product plan: booking, payments and branded websites first; shop tools and
the chat agent next; voice AI after that.

## Stack

Architecture follows the MAD Stack shape, but this is its own product.

| Layer                  | Choice                                                       |
| ---------------------- | ------------------------------------------------------------ |
| Web app, booking pages | Next.js 16 App Router, tRPC v11, Tailwind v4 (`apps/web`)    |
| Barber app             | Expo (not started)                                           |
| Shop websites          | Astro 7 SSR, multi-tenant, templates (`apps/sites`)          |
| Database and auth      | Supabase Postgres + Auth, Supabase client SDK, no ORM        |
| Validation             | Zod 4 using the Zod 3 compat API (`import { z } from "zod"`) |
| Payments               | Stripe Connect (not started; cash works today)               |
| Messaging, voice       | Twilio; managed voice platform (later phases)                |
| Monorepo               | pnpm + Turborepo                                             |

## Layout

```
apps/web/                # Next.js: booking pages + the tRPC booking API
  trpc/init.ts           # context + procedure levels (public → authed → shop → manager)
  trpc/routers/          # booking (public); schedule, appointments, me (staff)
  app/book/[shopSlug]/   # public booking flow
  app/dashboard/[shop]/  # admin (sign-in required): Today, Calendar, Clients, Services, Team, Website, Settings
  components/ui.tsx      # shared admin primitives (Button, Field, Input, Switch, Card…)
  app/login, app/auth/   # magic-link sign-in, callback, sign-out
  lib/booking/           # server-side booking context + pure helpers (tested)
  app/api/public/sites/  # public site data (by slug, or ?domain=) for apps/sites
  lib/supabase/          # user client (RLS), admin client (secret key), browser client
  proxy.ts               # refreshes Supabase auth cookies (Next 16's renamed middleware)
apps/sites/              # Astro: shop websites (SSR, one deployment serves every shop)
  src/middleware.ts      # subdomain / custom domain → /<slug>/… rewrite
  src/pages/[shop]/      # home, services/[service], barbers/[barber], sitemap
packages/site-kit/       # SiteData contract, hours, prices, JSON-LD, brand colors
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

## Web app and API

- tRPC procedure levels in `apps/web/trpc/init.ts`: `publicProcedure` (anyone),
  `authedProcedure` (signed-in staff; `ctx.supabase` runs under RLS),
  `shopProcedure` (active member of `input.shopId`), `managerProcedure`
  (owner or manager).
- Public booking procedures use `adminClient()`, which bypasses RLS. They must
  validate everything themselves and never return more than the public needs.
- Wrap Supabase results in `unwrap()`, which maps `LU*` codes to tRPC errors
  (`LU404` → NOT_FOUND, `LU409` → CONFLICT, `LU410` → PRECONDITION_FAILED,
  `LU422` → BAD_REQUEST).
- Admin routers: `schedule`, `appointments`, `clients`, `services`, `team`,
  `settings`, `website`, `calendar`. Owner/manager-only writes use `managerProcedure`; barbers can
  edit their own hours and time off. Admin pages gate with `viewerShop()` /
  `managerShop()` from `lib/dashboard/viewer.ts`.
- Brand color: `shops.brand_color`, applied with `brandStyle()`, which sets
  both `--brand` and Tailwind's `--color-brand` (a subtree can't override
  the latter through `--brand` alone).
- `appointments.checked_in_at` / `completed_at` are set by a trigger on status
  change; they drive the live "in the chair" timer.
- Staff booking (`calendar.book`): phone calls, DMs and walk-ins. Staff may
  book outside working hours, but still through `create_appointment`, so the
  database still blocks overlaps. Barbers can only book or move their own
  chair. Walk-in clients may have no phone (`clients.phone` is nullable);
  every other source needs one. `calendar.reschedule` moves a confirmed
  booking via `reschedule_appointment` (keeps the booked services and length).
- Booking flow: `booking.availability` → `booking.hold` (10-minute hold,
  re-checked with `isSlotAvailable`) → `booking.confirm` (matches returning
  clients by phone).
- Next 16: request APIs (`params`, `cookies()`) are async, and middleware is
  `proxy.ts`. Next's docs ship in `node_modules/next/dist/docs/`.

## Staff sign-in

- Supabase Auth email magic links. `/auth/callback` accepts both `?code=`
  (PKCE, same browser only) and `?token_hash=&type=` (any device). For the
  latter, set the Magic Link email template to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`.
- Staff are invited by putting their email on a `staff` row. On sign-in,
  `claim_staff_invites()` links every matching unclaimed row to the user.
- Auth → URL Configuration must list the site URL and
  `https://<domain>/auth/callback` (plus `http://localhost:3000/**` for dev).
- `payments.recorded_by` has no foreign key on purpose: the ledger is
  immutable, so it can't be cleared when a user is deleted.

## Shop websites

- `apps/sites` never talks to Supabase. It reads `SiteData` (from
  `@lineup/site-kit`) from the web app's public site API, which returns only
  public fields, bookable barbers and services someone offers.
- Env: `LINEUP_API_URL` (web app origin), optional `SITES_ROOT_DOMAIN`
  (enables `<slug>.<root>` hosts) and `LINEUP_API_BYPASS` (Vercel protection
  bypass secret while the web app is behind Vercel Authentication).
  Declare them with `access: "secret"` so they're read at runtime: turbo's
  strict env mode strips undeclared vars from builds, and Astro requires
  `public` server vars at build time.
- The dashboard's Website page (`website.overview`) links to the site via
  the web app's `SITES_URL` env (a custom domain wins), shows a completeness
  checklist built from the same `SiteData`, and 30-day bookings by `source`.
- Analytics are cookie-free. The site's inline script beacons page views and
  Book clicks to its own `/<slug>/api/event`, which forwards them (with the
  visitor's IP and user agent) to the web app's
  `/api/public/sites/[slug]/events`. The booking page records `booking_view`
  itself. `recordSiteEvent` drops bots and stores only a daily-rotating
  visitor hash (salt: `ANALYTICS_SALT`, else the Supabase secret key).
  `site_events` is readable by owners/managers only; `site_analytics()`
  aggregates it (SECURITY INVOKER). The script skips frames (the dashboard
  preview) and automated browsers.
- Settings → Connections stores a shop's GA4 id, Meta Pixel id and Search
  Console token (`settings.updateConnections`; parsers in
  `lib/site/connections.ts` accept pasted snippets). They reach the site as
  `SiteData.tracking` and are strictly format-checked in the API and the
  database, because they're written into the site's HTML.
- Book links go through `bookingLink()` so attribution (`src=website`) is
  always set. Pages cache for 60s at the edge.

## Website templates and the design editor

- A shop's site is `shops.site_template` plus `shops.site_content`: per
  template, an ordered list of sections `{ type, enabled, props }`. The
  model, schemas, defaults and template registry live in
  `packages/site-kit/src/design.ts`. Always read stored content through
  `resolveDesign()` (fills defaults, drops anything invalid); save through
  `designInput` + `mergeDesign()` (keeps other templates' content).
- Sections hold presentation and marketing copy only. Services, prices,
  hours, team and address always come from Lineup data.
- Templates live in `apps/sites/src/templates/<id>/` (`classic`,
  `contact-sheet`). A template's global CSS must be scoped (Contact Sheet
  uses `html.t-cs`) because Astro bundles every imported template's CSS into
  the page. Shared head/body bits: `components/Tracking.astro`,
  `components/Beacon.astro`.
- Photos go in the public `site-media` Storage bucket under `<shop id>/`.
  Storage RLS lets only that shop's owners/managers write; the editor
  uploads from the browser after resizing to 2000px and re-encoding (which
  strips EXIF/GPS). `saveDesign` rejects media paths outside the shop's
  folder.
- `?preview=1` (optionally `&template=`) on a site page skips every cache
  and renders a saved but not-yet-live template; the dashboard's Design page
  (`/dashboard/<shop>/website/design`) uses it for its live preview.
- The booking page matches a themed template (`app/book/[shopSlug]/themes.ts`):
  it swaps the flow's design tokens on a wrapper and adds a scoped
  stylesheet, so the booking flow itself stays the same for every theme.
- Adding a template: add its id to `TEMPLATE_IDS`/`TEMPLATES`, the
  `site_template` CHECK constraint (new migration), and a
  `templates/<id>/Home.astro` wired into the `[shop]` pages.

## Text messages

- Lineup owns the Twilio account; shops never see keys. Pilot: one shared
  toll-free number, transactional texts only, each text starting with the
  shop's name. Later: a registered number per shop (10DLC via Twilio
  sub-accounts), which needs a per-shop sender and per-shop STOP.
- Texts cost per segment, so every template must fit one (160 GSM-7
  characters, 70 with any other character). `fit()` in `templates.ts` tries
  shorter wordings; `segments()` counts. Keep the STOP line in the
  confirmation. "C" replies get no response; the 2-hour reminder is off by
  default.
- `lib/sms/`: `templates.ts` (message copy, reply parsing), `reminders.ts`
  (`reminderDue`), `twilio.ts` (REST client, webhook signatures),
  `notify.ts` (`textBooking(appointmentId, kind)`, server only).
- Texts go only to clients with `sms_consent_at` set, only for confirmed
  bookings, and only when the shop's `sms_enabled` (and per-reminder flags)
  are on. Staff bookings text the client only if "Client agrees to texts"
  was ticked; checked-in walk-ins get nothing.
- Every text in or out is a `messages` row. `messages_once_per_booking`
  (unique on appointment + kind) is how a send is claimed, so retries never
  double-text. Without Twilio keys, sends are logged as `skipped`.
- Confirmations are sent with `after()` from `booking.confirm` and
  `calendar.book`. Reminders: Supabase pg_cron job `text-reminders` calls
  `GET /api/cron/reminders` every 15 minutes with `Bearer CRON_SECRET`; the
  URL and secret live in Vault (`reminders_url`, `cron_secret`) and must
  match the web app's `CRON_SECRET`.
- Replies arrive at `POST /api/webhooks/twilio` (signature checked; set
  `TWILIO_WEBHOOK_URL` if the public URL differs from the request URL):
  `C` sets `client_confirmed_at`, `X` cancels unless inside the
  cancellation window, `STOP` clears consent.
- Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (number or
  `MG…` Messaging Service), `CRON_SECRET`. US numbers need A2P 10DLC.

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
migration in `supabase/migrations` has been applied to it. The security
advisor's only finding is an accepted WARN: `claim_staff_invites()` is a
SECURITY DEFINER function signed-in users can call. That's intended; it only
links the caller's own verified email. `.mcp.json` configures the Supabase MCP
server for this project. Copy `apps/web/.env.example` to
`apps/web/.env.local` and add the secret key; never commit secrets. The
hosted project has the seed's demo shop, "Southside Cuts" (`/book/southside-cuts`).

## Commands

```bash
pnpm install
pnpm dev             # web on http://localhost:3000, sites on http://localhost:4321
pnpm typecheck
pnpm lint
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
