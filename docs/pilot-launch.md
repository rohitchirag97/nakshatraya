# Pilot launch runbook

For the platform team taking the MVP to 3 pilot tenants (PRD Phase 5). Gate: all 3 are selling reports.

## 1. Blockers: none of these can be skipped before the first real sale

| # | Item | Why it blocks | Owner |
|---|---|---|---|
| 1 | **SMS provider for OTP** (with DLT sender and template) | Production refuses to send OTPs, so nobody can log in. Wire it in `server/src/sms.ts`. | Product decision |
| 2 | **Report text**: 264 reviewed entries per language (`server/scripts/content.ts status`) | A language can't be enabled, and no report can be made, until it's complete (FR-16). | Astrologer |
| 3 | **Golden set**: 50 charts checked against Jagannatha Hora | The accuracy gate (PRD) is unproven; the public `/accuracy` page will say "0 of 50". | Astrologer |
| 4 | **Razorpay live keys + Route**, and a KYC-approved linked account per tenant | Without the linked account, "Get kundli" says the astrologer can't take payments. | Each tenant + us |
| 5 | **Licence decision** on `@img/sharp-libvips` (LGPL-3.0, via Next.js) | `bun run licenses` fails, so CI is red. | Product decision |
| 6 | **CA sign-off**: SAC 999799, CGST+SGST for all B2C sales, GST on our commission | Invoices are legal documents in the tenant's name. | Finance |
| 7 | **Database backups**, daily, kept 30 days (deferred for now) | PRD non-functional requirement. Pick the Mumbai Postgres provider and turn them on. | Product decision |
| 8 | **Data residency review**: Workers run at the edge, R2 has no India jurisdiction, Vercel runs in `bom1` | Consent text and any "data stays in India" claim must match reality. | Counsel |

## 2. One-time production setup

**Postgres (Mumbai)**
1. Create the database; run `db/init.sql` with a real password for `app_user`.
2. `DATABASE_OWNER_URL=<owner url> bun run db:migrate`
3. Import places: `DATABASE_URL=<owner url> bun packages/db/src/import-geonames.ts <folder with cities15000.txt + admin1CodesASCII.txt>`
4. Import reviewed text: `DATABASE_OWNER_URL=<owner url> bun server/scripts/content.ts import en en.json "<reviewer>"` (and `hi`).

**Upstash Redis**: create a database in the Mumbai region; note the REST URL and token.

**Cloudflare** (zone `ourapp.in`)
1. DNS: proxied wildcard `*.ourapp.in` (any placeholder target; the Worker answers every request).
2. `bunx wrangler hyperdrive create jyotish --connection-string="postgres://app_user:...@<host>/jyotish"` and put the id in `server/wrangler.jsonc` (both `hyperdrive` blocks).
3. `bunx wrangler r2 bucket create jyotish-reports`. Browser Rendering needs the Workers paid plan.
4. Secrets (`--env production`): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `PLATFORM_ADMIN_TOKEN`, `REPORT_TOKEN_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `WEB_PROXY_SECRET`. Use long random values for the tokens and secrets.
5. Set `WEB_UPSTREAM` in `env.production.vars` to the Vercel production URL, then `bun --cwd server wrangler deploy --env production`.
6. Workers Logs are on (`observability`). In the dashboard, add an alert on the Worker's error rate.

**Vercel** (web app)
1. New project, root directory `apps/web`; `vercel.json` pins the function region to `bom1` (Mumbai) and installs from the repo root.
2. Env var `WEB_PROXY_SECRET`, the same value as the Worker secret. Leave `API_ORIGIN` unset: production calls `https://<tenant host>/api`.
3. No custom domains on Vercel. Tenants reach it only through the Worker; direct `vercel.app` hits get 404.

**Razorpay**: webhook URL `https://<any tenant host>/api/razorpay/webhook`, event `order.paid`, secret = `RAZORPAY_WEBHOOK_SECRET`.

**Uptime**: point any pinger (Cloudflare Health Checks, UptimeRobot, ...) at `https://<a pilot tenant>/api/health` every minute; it returns 503 if Postgres or Redis is unreachable.

## 3. Onboarding a tenant (target: under 1 hour)

Astrologers apply on the platform website (`https://ourapp.in`, the form at `#apply`): business name, contact, city, preferred site name, their PDF and printed-copy prices, and whether they want the shop and online consultation. We run the panel at `https://ourapp.in/platform` (or `admin.ourapp.in/platform`), logging in with an OTP on a platform owner's phone. Add or remove owners with `DATABASE_OWNER_URL=<prod owner url> bun run platform:add-admin [--remove] +91XXXXXXXXXX`. Production login needs the SMS provider; until then the code is shown on screen only outside production.

1. Call the applicant. Ask them to start their Razorpay Route linked account and KYC (this can take days).
2. **Approve** in the panel's Applications list, with the site name (subdomain). This creates the tenant with the applicant's prices and features, and their phone as the owner. Or use **Add tenant** for someone who didn't apply.
3. **Wallet:** the owner recharges online from their Sales page, or pays us by UPI/bank and we use **Edit** → **Add credit** with the reference as the note. Every kundli costs the platform kundli fee (set at the top of the panel; a tenant can have a special fee); below it nobody on their site can create kundlis. The Razorpay webhook must include `order.paid` for wallet recharges too.
4. When KYC is done: **Edit** the tenant, set the Razorpay linked account (`acc_...`) and our commission % (pilots can be 0). Custom domain goes here too; the tenant points the domain's DNS at Cloudflare first.
5. Owner logs in at `https://<slug>.ourapp.in/login` with their phone, then on `/admin` sets branding, languages, chart style, prices, shop/consultation and GST details.
6. Owner adds astrologers (`POST /api/tenant/staff`); they make free reports for clients.

The same actions are API calls (`/api/admin/...`, `Authorization: Bearer $PLATFORM_ADMIN_TOKEN`) if you need to script them; see the README.

## 4. Before a tenant goes live

- Smoke test on their host: log in, add a person, buy at ₹1 (set the price, then set it back), PDF downloads, invoice opens, the CSV on `/admin` has the order.
- Load test once per environment (creates real reports and Browser Rendering sessions):
  `bun scripts/load-test.ts --base https://<slug>.ourapp.in --sid <owner session> --profile <profile id> --pdfs 20 --concurrency 4`
  Targets: report data p95 < 1 s, fresh PDF p95 < 10 s. A 503 on a PDF means Browser Rendering is at its concurrency limit; the customer is told to retry.

## 5. When something goes wrong

- **Payments:** the webhook and the checkout callback can both arrive or arrive twice; unlocking is idempotent and an amount mismatch never unlocks. Check Workers Logs for `webhook amount mismatch`.
- **PDFs:** each is rendered once and kept in R2. A bad render is fixed by deploying the page fix and creating a new report.
- **Rollback:** `bunx wrangler rollback --env production` for the API; "Instant Rollback" in Vercel for the web app. Migrations only add columns and tables, so the previous code runs against the new schema.
