# Jyotish

White-label Vedic astrology SaaS. See [PRD.md](PRD.md).

## Layout

- `packages/engine`: the chart engine and content-key catalogue (pure TS). See [its README](packages/engine/README.md)
- `packages/db`: Drizzle schema, migrations, `createDb()`/`withTenant()`, the RLS isolation test, GeoNames import + place search
- `server`: the API, a Hono app on **Cloudflare Workers** (Hyperdrive → Postgres, Upstash Redis, Browser Rendering for PDFs, R2 for stored PDFs)
- `server/scripts/content.ts`: content library tool for the astrologer (status / template / import)
- `apps/web`: Next.js on Vercel (Mumbai): tenant home, login, my kundlis, the report page (also printed to PDF), invoices, owner admin, `/accuracy`
- `docs/pilot-launch.md`: production setup, tenant onboarding and the launch blockers
- `scripts/load-test.ts`: report and PDF timings against any environment
- `scripts/check-licenses.ts`: fails if any dependency isn't permissively licensed
- `db/init.sql`: creates `app_user`, the non-owner role the app connects as, so RLS applies to it

## How a request flows

```
browser ──▶ brand.ourapp.in ──▶ Worker (server/)
                                  ├─ /api/*  → Hono API ──Hyperdrive──▶ Postgres (Mumbai), Upstash Redis
                                  └─ else    → Next.js on Vercel (+ tenant host, shared secret)
PDF:  Worker ──Browser Rendering──▶ Chromium opens /report/<id>?t=<signed 2-min token> ──▶ R2
```

## Local setup

The repo is on `/run/media`, which snap Docker can't read by default, and the socket is root-only:

```sh
sudo snap connect docker:removable-media   # once
```

Then, from the repo root:

```sh
cp .env.example .env
cp server/.dev.vars.example server/.dev.vars
sudo docker compose up -d      # Postgres 17, Redis 7, Upstash-compatible proxy on :8079
bun install
bun run db:migrate             # runs as postgres (owner)
bun test                       # includes the cross-tenant RLS test
# places: download cities15000.zip + admin1CodesASCII.txt from download.geonames.org/export/dump/, unzip, then
DATABASE_URL=$DATABASE_OWNER_URL bun packages/db/src/import-geonames.ts <folder>

bun --cwd server wrangler dev --port 8787                  # API (workerd, like production)
API_ORIGIN=http://localhost:8787 bun --cwd apps/web dev    # web on http://<slug>.localhost:3001
```

PDFs locally use `wrangler dev`'s Browser Rendering, which starts a local Chromium: the first PDF after
starting can take ~30 s, then 2–3 s each.

Tests use their own database (`.env.test`), so they never touch dev or demo data. Create it once:

```sh
sudo docker compose exec postgres createdb -U postgres jyotish_test
DATABASE_OWNER_URL=postgres://postgres:postgres@localhost:5432/jyotish_test bun run db:migrate
```

Checks that CI runs: `bun run lint`, `bun run typecheck`, `bun run licenses`, `bun test`.

## Tenant data rule

Read or write tenant tables only through `withTenant(tenantId, tx => ...)`. It sets `app.tenant_id` for that one transaction, and Postgres RLS filters every query by it. With no tenant set, tenant tables return nothing.

After changing `schema.ts`, run `bun run db:generate`. Any new tenant table needs `ENABLE`/`FORCE ROW LEVEL SECURITY`, a `tenant_isolation` policy and grants in a new custom migration (copy `drizzle/0001_rls.sql`).

## Content library (FR-11, FR-16)

The kundli uses 264 keys (`lagna:sign:Leo`, `planet:Mars:house:10`, `moon:nakshatra:Rohini`, `dasha:Venus`, …).
A language can be enabled for a tenant, and reports made in it, only when all 264 have reviewed text.

```sh
bun --env-file=.env server/scripts/content.ts status
bun --env-file=.env server/scripts/content.ts template hi > hi.json     # fill in the empty strings
bun --env-file=.env server/scripts/content.ts import hi hi.json "Reviewer Name"
```

Each report freezes its text when it's created, so later edits never change an issued report.

`content/drafts/{en,hi,gu}.json` are **AI drafts** built by `server/scripts/draft-content.ts` from classical
significations (planet themes, sign qualities, house areas, dignity, house type). They are a starting point
for the astrologer, not reviewed text: in the dev database they're imported under the reviewer name
"AI draft – needs astrologer review". Before launch, the astrologer edits these files and re-imports them
under their own name.

## API

All routes are under `/api` on the tenant host (`<slug>.$APP_DOMAIN` or a custom domain). Sessions are a host-only `sid` cookie backed by Redis.

| Route | Who |
|---|---|
| `POST /api/apply` `{businessName, contactName, phone, city, preferredSlug?, wantsShop, wantsConsult, pdfPricePaise, printPricePaise, ...}` | anyone (platform website), 5 per IP per hour |
| `POST /api/admin/otp` `{phone}`, `POST /api/admin/verify` `{phone, code}`, `POST /api/admin/logout` | platform owners (phones in `platform_admins`, added with `bun run platform:add-admin +91...`): OTP → 12 h `padm` cookie for the `/platform` panel. Outside production the OTP response includes `devCode` |
| `POST /api/admin/tenants` `{slug, name, ownerPhone, kundliPricePaise?, printPricePaise?, shopEnabled?, consultEnabled?}` | platform admin (`Authorization: Bearer $PLATFORM_ADMIN_TOKEN` or the cookie) |
| `POST /api/admin/tenants/:slug/credit` `{amountPaise, note?}` | platform admin: wallet top-up (negative = correction) |
| `GET /api/reports/:id/pdf?size=a5&cover=0&layout=booklet` | tenant staff: print layouts (A5 has its own layout; booklet = A5 pages two per A4 sheet in fold order, padded to a multiple of 4; `cover=0` drops our cover). Shown inline; the `/print/:id` page previews and prints them |
| `POST /api/reports/:id/offline-payment` `{kind, amountPaise, method: cash\|card\|upi\|other, reference?}` | tenant staff: a sale paid at the counter. Paid order with the next invoice number, no platform commission, kundli unlocks; a printed copy counts as handed over. Shown in Sales, the CSV and on the invoice as "Paid by" |
| `GET /api/tenant/wallet` | owner: balance, fee per kundli, last 50 ledger entries |
| `POST /api/tenant/wallet/topup` `{amountPaise}` (₹100–₹1,00,000), `/topup/verify`, `/topup/fake-pay` (dev) | owner: online recharge |
| `GET`/`PATCH /api/admin/settings` `{reportFeePaise}` | platform admin: the platform-wide kundli fee |
| `GET /api/admin/tenants`, `GET /api/admin/applications`, `POST /api/admin/applications/:id/approve` `{slug}` / `reject` | platform admin |
| `GET /api/tenant` | public branding |
| `PATCH /api/tenant` | owner |
| `POST /api/tenant/staff` `{phone, role: "astrologer"}` | owner |
| `POST /api/auth/otp` `{phone}` → `POST /api/auth/verify` `{phone, code, consent}` | anyone; `consent: true` required for a new account |
| `POST /api/auth/password`, `/api/auth/password/login`, `/api/auth/logout` | logged in / anyone |
| `GET /api/places?q=` | public |
| `GET/POST /api/profiles`, `GET/DELETE /api/profiles/:id` | customers see their own, staff see all |
| `GET /api/me/export`, `DELETE /api/me` | logged in (owners can't delete themselves) |
| `POST /api/reports` `{profileId, lang}` | logged in; customers' reports are `locked` until paid (Phase 4), staff's are `ready` |
| `GET /api/reports`, `GET /api/reports/:id` | the report's customer or tenant staff; 402 while locked |
| `GET /api/reports/:id/pdf` | same; rendered on first download, then served from R2 |
| `POST /api/reports/:id/order` | the report's customer: opens a Razorpay order, tenant's share routed to their linked account |
| `POST /api/orders/verify` `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` | checkout callback: unlocks the report at once |
| `POST /api/razorpay/webhook` | Razorpay (`order.paid`), signature-checked; same unlock, idempotent |
| `GET /api/orders`, `GET /api/orders/:id` | a customer's payments; the invoice for a paid one (buyer or owner) |
| `GET /api/tenant/settings`, `/orders`, `/orders.csv`, `/revenue`, `/customers` | owner only |
| `PATCH /api/admin/tenants/:slug` `{razorpayAccountId, commissionBps, name, domain, kundliPricePaise, printPricePaise, shopEnabled, consultEnabled}` | platform admin |

Web pages: on the platform host (no tenant), `/` is the partner landing page with the apply form and `/platform` is our admin panel. On a tenant host: `/` (tenant home), `/login`, `/app` (people, buy, reports, payments), `/report/:id`, `/invoice/:id`, `/admin` (owner: price, GST, revenue, orders).

## Payments (Razorpay Route)

Prices include GST. Each sale: platform keeps `commissionBps` (default 10%), the rest is transferred to the
tenant's linked account in the same Razorpay order. A report unlocks from the checkout callback (signature
checked) or the `order.paid` webhook, whichever comes first; both allocate one consecutive invoice number
(`2627/00001`, per tenant per financial year).

To take a real test payment:
1. Razorpay dashboard (test mode): create API keys and enable Route; create a linked account for the tenant.
2. Put the keys in `server/.dev.vars` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
3. `PATCH /api/admin/tenants/<slug>` with `{"razorpayAccountId":"acc_..."}`; the owner sets price and GST on `/admin`.
4. Webhook: point Razorpay at `https://<any tenant host>/api/razorpay/webhook`, event `order.paid`, and put its
   secret in `RAZORPAY_WEBHOOK_SECRET`. Locally Razorpay can't reach you without a tunnel; the checkout
   callback still unlocks the report.

In dev, OTP codes are printed to the API log; production refuses to send until an SMS provider is wired in `server/src/sms.ts`.

## Deploying the API

```sh
bunx wrangler hyperdrive create jyotish --connection-string="postgres://app_user:...@<mumbai-host>/jyotish"
bunx wrangler r2 bucket create jyotish-reports
# put the Hyperdrive id and your zone in server/wrangler.jsonc (env.production), then:
for s in UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN PLATFORM_ADMIN_TOKEN REPORT_TOKEN_SECRET \
         RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET; do
  bunx wrangler secret put $s --env production --cwd server; done
bun --cwd server wrangler deploy --env production
```

Needs the Workers paid plan: password hashing (pure-JS argon2id) takes ~0.5 s CPU, over the free plan's 10 ms.

## Tenant wallet (platform fee)

Each tenant has a prepaid wallet (`tenants.wallet_paise`). Creating a kundli, by a customer or by staff, costs `report_fee_paise` (default ₹10), taken in the same transaction as the report: no balance, no report (402 `wallet_empty`). A customer clicking again for the same person and language reuses their unpaid kundli, so it isn't charged twice. Every change is a row in `wallet_transactions` (append-only, one `report_fee` per report). The fee is set platform-wide by the platform admin (`platform_settings`, `/platform` → Kundli fee), with an optional per-tenant override (`tenants.report_fee_paise`, null = platform fee). Owners recharge online from their Sales page (`POST /api/tenant/wallet/topup`, paid to the platform with no Route transfer; credited by the checkout callback or the `order.paid` webhook with `notes.purpose = "wallet"`, once). The platform team can also add credit by hand in the panel.

