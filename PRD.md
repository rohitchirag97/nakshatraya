# Jyotish SaaS PRD

Nov 23, 2026 · Chirag Rohit · v2 (stack updated to Bun/Redis, PDF generated in the request, phased plan added)

## Overview

We will build a white-label Vedic astrology platform. Astrologers, temples and astro brands in India sign up as tenants and sell kundli, matching and panchang reports to their own customers in 9 Indian languages. All calculations and report text run in-house, with no third-party astrology or LLM API.

**Problem.** Small astrology businesses rent per-call astrology APIs. Those cost money per report, give English-first output, and lock the business into someone else's numbers and text. Building their own engine is out of reach for most of them.

### Goals

- A tenant can go live on its own subdomain with its branding in under 1 hour, with no code.
- An end customer gets a correct kundli PDF in their language in under 10 seconds, on the spot, with no waiting or "we'll email you".
- Report cost is close to zero: compute and storage only, no per-call fees.
- Chart results match a trusted reference (Jagannatha Hora) to within 1 arcminute.

### Non-goals for v1

- Live chat or call consultations with astrologers.
- Western, KP or Lal Kitab systems.
- AI-written or free-form predictions. Report text comes from a reviewed content library.
- Native mobile apps. The web app is responsive.
- Background job queues. Every report is generated inside the request.

## Users and tenants

A tenant is one business with its own domain, branding, customers and pricing. One person can be a customer of several tenants, but those accounts never share data.

| Persona           | Who                               | Main jobs                                                      |
| ----------------- | --------------------------------- | -------------------------------------------------------------- |
| Platform admin    | Our team                          | Onboard tenants, manage plans, edit the master content library |
| Tenant owner      | Astrologer, temple or astro brand | Set branding, languages, prices and domain; see sales          |
| Tenant astrologer | Staff of a tenant                 | Make charts for clients, add personal notes to a report        |
| End customer      | Public user of a tenant site      | Enter birth details, buy and download reports                  |

### Tenant model

- Each tenant gets a subdomain (`brand.ourapp.in`) and can add a custom domain.
- Branding: logo, primary colour, report cover, footer text and contact details.
- Settings: default and enabled languages, chart style (North or South Indian), ayanamsa (Lahiri by default), report prices.
- A tenant can override any interpretation paragraph with its own text. Otherwise the master library text is used.

## Scope

The MVP is one report type, the kundli, done well in English, Hindi and Gujarati, sold by real tenants. Everything else waits until that works.

| Feature                                                       | Release | Priority |
| ------------------------------------------------------------- | ------- | -------- |
| Chart engine: D1, D9, nakshatra, Vimshottari dasha            | MVP     | P0       |
| North and South Indian chart views                            | MVP     | P0       |
| Kundli PDF report                                             | MVP     | P0       |
| English, Hindi and Gujarati                                   | MVP     | P0       |
| Tenant subdomain, branding and settings                       | MVP     | P0       |
| Customer sign-up and saved profiles                           | MVP     | P0       |
| Online payment per report                                     | MVP     | P0       |
| 20 core yogas (Gajakesari, Pancha Mahapurusha, ...)                          | MVP     | P1       |
| Doshas (Manglik with cancellation, Kaal Sarp, Sade Sati/Dhaiya, Pitru, Grahan, Guru Chandal, Shrapit) | MVP | P0 |
| Life areas: marriage (partner rashis), career (job/business, fields), education, home & vehicles, foreign travel; each with obstacles and remedies (mantra, daan, vrat, puja; no gemstones) | MVP | P0 |
| Chandra kundli, full Vimshottari antardasha table, Ashtakavarga (BAV + SAV) | MVP | P0 |
| Pricing: digital PDF ₹99; printed copy ₹500 incl. PDF, posted by the tenant (per-tenant prices) | MVP | P0 |
| Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam           | v1.1    | P1       |
| Kundli matching (Ashtakoota, 36 gunas)                        | v1.1    | P1       |
| Daily panchang page per tenant                                | v1.1    | P2       |
| Custom domains                                                | v1.1    | P2       |
| Tenant text overrides                                         | v1.2    | P2       |
| Tenant subscription billing                                   | v1.2    | P2       |
| Annual forecast (transits) report                             | v1.2    | P3       |

## Functional requirements

### Birth data

- **FR-1:** Collect name, gender, date, time and place of birth. If the user doesn't know the time, mark it unknown and drop lagna-based sections from the report.
- **FR-2:** Place search runs offline on GeoNames (cities over 15,000 people), searchable in English and in Indian scripts. Picking a place fills in latitude, longitude and time zone.
- **FR-3:** Convert local time to UTC with historical tzdata, so India's pre-1947 and wartime offsets are right.
- **FR-4:** Save several profiles per customer (self, family).

### Chart engine

- **FR-5:** Sidereal positions for the 7 grahas plus Rahu and Ketu, with Lahiri ayanamsa by default. Show sign, degree, nakshatra, pada, house, retrograde, combust and dignity (exalted, own sign, debilitated).
- **FR-6:** Lagna and whole-sign houses. D1 and D9 charts in the MVP, then D2, D3, D7, D10 and D12 later.
- **FR-7:** Vimshottari mahadasha and antardasha with exact start and end dates, the current period highlighted.
- **FR-8:** Rule-based checks: Manglik with its cancellation rules, Sade Sati periods, Kaal Sarp, and 20 core yogas (for example Gajakesari and the Pancha Mahapurusha yogas).
- **FR-9:** The engine is a pure TypeScript package with no I/O, so the API and the browser give the same results.

### Reports

- **FR-10:** The kundli report has a cover with tenant branding, birth details, D1 and D9 charts, the planet table, dasha table, doshas and yogas, and interpretation text for each planet's sign and house, the lagna, the Moon nakshatra and the current dasha.
- **FR-11:** Report text is put together from the content library by chart facts, for example `planet:Mars:house:10`. There's no free-form generation.
- **FR-12:** Each report shows on the web and downloads as a PDF. Both come from the same React page.
- **FR-13:** Reports keep the engine version and inputs used. Regenerating one gives the same result unless the customer asks for an update.
- **FR-13a:** Reports are generated in the request, with no queue. The web report renders as soon as payment clears. The PDF is rendered on the first download request, streamed back, and stored. Later downloads serve the stored file.

### Languages

- **FR-14:** The UI and reports support English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada and Malayalam.
- **FR-15:** Planet, sign, nakshatra and house names are translated in chart drawings too.
- **FR-16:** A language goes live for a report type only when 100% of its content keys have reviewed text. Missing keys block publishing instead of falling back to English quietly.

### Kundli matching (v1.1)

- **FR-17:** Ashtakoota score out of 36 with all 8 kootas, Manglik compatibility for both people, and a verdict band.

### Panchang (v1.1)

- **FR-18:** Daily tithi, nakshatra, yoga, karana, vaara, sunrise and sunset, and Rahu kaal for the tenant's default city, with a switch to the customer's own city.

### Tenant admin

- **FR-19:** Self-serve setup: logo, colour, languages, chart style, prices and domain, with a live preview of the report cover.
- **FR-20:** Lists of customers and orders, CSV export, and revenue per month.
- **FR-21:** Roles: owner and astrologer. An astrologer can make charts and add notes but can't change settings or prices.

### Payments

- **FR-22:** Customers pay per report through Razorpay (UPI, cards, netbanking), with money paid to the tenant's account through Razorpay Route. A report unlocks when the payment webhook confirms.
- **FR-23:** GST invoice for each order, in the tenant's name.

## Non-functional requirements

| Area             | Requirement                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accuracy         | Graha and lagna longitudes within 1 arcminute of Jagannatha Hora on a golden set of 50 charts (1900 to 2050, Indian cities). CI runs this test on every change. |
| Boundary cases   | When a graha or lagna is within 0.1° of a sign or nakshatra edge, show the degree and an "on the boundary" note.                                                |
| Speed            | Chart compute under 50 ms. Web report under 1 s. PDF under 10 s at p95, measured end to end in the request.                                                     |
| PDF concurrency  | One warm Chromium per API instance, a new page per PDF, at most about 4 PDFs at once per instance. Above that limit, return 503 with a retry hint.              |
| Tenant isolation | Every tenant table has `tenant_id`, enforced by Postgres row-level security. A cross-tenant read test runs in CI.                                               |
| Privacy          | Birth data is personal data under India's DPDP Act 2023. Get consent at sign-up, let customers export and delete their data, and keep data hosted in India.     |
| Security         | Passwords hashed with argon2, OTP login by phone. Each tenant's admin routes are scoped by role. Webhooks are verified by signature and are idempotent.         |
| Licensing        | Only permissive-licence dependencies (MIT, BSD, Apache). No Swiss Ephemeris unless we buy its commercial licence. GeoNames data is CC-BY, so credit it.         |
| Indic rendering  | Use Noto fonts for every script and render PDFs in Chromium, so conjuncts shape correctly. Each language is checked visually before release.                    |
| Availability     | 99.5% monthly uptime. Daily database backups, kept 30 days.                                                                                                     |
| Reproducibility  | Engine version stored on every report, so an old report never changes without notice.                                                                           |

## Architecture and tech stack

It's one TypeScript monorepo, and the astrology engine is a shared package. The web app and the API compute the same chart, and the browser never talks to the database directly.

Razorpay is the only external API, and it handles payments only. Everything astrological runs on our servers. There is no background worker or job queue. Charts, reports and PDFs are all produced inside the HTTP request.

| Layer | Choice | Why |
| --- | --- | --- |
| Monorepo | Bun workspaces (`packages/engine`, `packages/db`, `server`, `apps/web`) | Shared types and engine, no extra tooling |
| Frontend | Next.js (App Router), next-intl | One React page for the web report and the PDF; translated UI |
| API | Hono on Cloudflare Workers, served at `<tenant host>/api/*` | Same-origin with the web app, no servers to run |
| Database | Postgres with Drizzle, managed in Mumbai, reached through Cloudflare Hyperdrive | Row-level security set per transaction; data at rest in India |
| Cache / ephemeral state | Upstash Redis (Mumbai region, HTTP) | OTP codes (with TTL), rate limits, sessions; Workers can't hold TCP Redis |
| Ephemeris | astronomy-engine (MIT) | Offline, no data files, about 1 arcminute accuracy |
| Places and time zones | GeoNames, Luxon | Offline, historical tzdata (GeoNames gives each city's zone, so no geo-tz) |
| PDF | Cloudflare Browser Rendering (Chromium) via @cloudflare/playwright, inside the request | Correct Indic shaping, same React page as web |
| File storage | Cloudflare R2 | Stored PDFs |
| Passwords | argon2id in pure JS (@noble/hashes) | Workers can't compile WASM at runtime; needs the Workers paid plan (~0.5 s CPU per hash) |
| Local dev / tests | Bun, Docker Postgres + Redis + Upstash-compatible proxy, `wrangler dev` | Same clients as production |

### PDF flow (in the request)

1. `GET /api/reports/:id/pdf` checks the user may see the report and that it isn't locked.
2. If a stored PDF exists in R2, stream it.
3. Otherwise, the Worker signs a 2-minute link to `/report/<id>`, Browser Rendering opens it and prints an A4 PDF, and the Worker stores it in R2 and streams it.
4. If Browser Rendering is at its concurrency limit, return 503 with `Retry-After`.

Measured locally: 2–3 s per new PDF, 0.15 s when stored.

## Data model

All tables except `tenants`, `places` and the master `content` live under row-level security keyed on `tenant_id`. All tenant-scoped queries go through one helper, `withTenant(tenantId, tx)`, which sets `app.tenant_id` for the transaction.

| Table             | Key columns                                                                                       | Notes                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| tenants           | id, slug, domain, logo_url, brand_color, default_lang, enabled_langs, chart_style, ayanamsa, plan | One row per business                                      |
| users             | id, tenant_id, phone, email, role (owner, astrologer, customer)                                   | A person has a separate row in each tenant                |
| profiles          | id, tenant_id, user_id, name, gender, birth_local, birth_utc, time_known, place_id, lat, lon, tz  | Birth details                                             |
| places            | id, name, alt_names, admin1, country, lat, lon, tz, population                                    | GeoNames import, shared by all tenants                    |
| charts            | id, tenant_id, profile_id, engine_version, result_json                                            | Cached engine output                                      |
| reports           | id, tenant_id, chart_id, type, lang, status, pdf_key, sections, created_at                        | `pdf_key` set on first download; `sections` = report text frozen at creation |
| orders            | id, tenant_id, report_id, amount_paise, razorpay_order_id, razorpay_event_id, status, invoice_no  | Payment state; `razorpay_event_id` unique for idempotency |
| content           | key, lang, text, reviewed_by, reviewed_at                                                         | Master interpretation library                             |
| content_overrides | tenant_id, key, lang, text                                                                        | Tenant's own wording (v1.2)                               |

## Release plan and phases

The MVP should be selling through 3 pilot tenants by week 16. The plan assumes 2 full-stack engineers and 1 astrologer writing content part-time. Each phase ends with a gate, and the next phase starts only once the gate is met.

**Critical path:** engine accuracy (Phase 1) and content writing (the astrologer). Both start in week 1.

### Phase 0: Foundations (weeks 1–2)

- Bun workspace monorepo, plus lint, typecheck and test in CI
- Postgres + Drizzle schema for all MVP tables, with RLS policies on every tenant table
- `withTenant(tenantId, tx)` helper as the only way to reach tenant data
- Cross-tenant read test in CI
- Licence check in CI that fails on GPL or AGPL dependencies
- Redis, local docker-compose, hosting account in an India region
- Astrologer starts the English content key list (~400 keys)

**Gate:** RLS test green, CI green, schema reviewed.

### Phase 1: Chart engine (weeks 2–6)

- `packages/engine`: pure TypeScript, no I/O (FR-9)
- astronomy-engine → tropical positions → Lahiri ayanamsa → sidereal positions
- 7 grahas plus Rahu and Ketu, lagna, whole-sign houses, D1, D9
- Nakshatra, pada, retrograde, combust, dignity
- Vimshottari mahadasha and antardasha with exact dates
- Boundary flag within 0.1° of a sign or nakshatra edge
- Birth data: GeoNames import with Indic alternate names, geo-tz and Luxon for historical UTC (FR-1 to FR-3)
- Golden set of 50 charts checked against Jagannatha Hora, run in CI
- Benchmark: chart compute under 50 ms
- `ENGINE_VERSION` stored with every result

**Gate:** all 50 golden charts within 1 arcminute. Nothing after this phase is worth building until it passes.

### Phase 2: Tenants, auth, profiles (weeks 5–9)

- Tenant resolved from the subdomain in middleware
- Tenant settings: logo, colour, languages, chart style, ayanamsa (Lahiri only in the MVP), prices
- Phone OTP login (Redis, with TTL and rate limits), argon2 passwords
- Roles: owner, astrologer, customer (FR-21)
- DPDP consent at sign-up, data export and delete
- Saved birth profiles with place search (FR-4)
- Platform admin page to onboard tenants

**Gate:** a test tenant goes live on a subdomain with its branding in under 1 hour, with no code.

### Phase 3: Kundli report (weeks 7–13)

- Content library with reviewed flag, and publishing blocked until 100% key coverage (FR-16)
- Report assembly: chart facts → content keys → text
- North and South Indian chart SVGs with translated labels (FR-15)
- One React report page for both web and PDF (FR-12)
- Web report shown instantly once payment clears
- PDF generated in the request: warm Chromium, new page per PDF, concurrency limit, stored after the first render (FR-13a)
- Engine version and inputs stored on each report, and regeneration is identical (FR-13)
- Charts without a known birth time leave out lagna-based sections
- P1, if time allows: Manglik with cancellation rules, Sade Sati, Kaal Sarp, 20 core yogas
- Hindi and Gujarati keys translated offline with IndicTrans2, then reviewed by a native speaker

**Gate:** web report under 1 s; PDF under 10 s at p95 under pilot load; Hindi and Gujarati conjuncts checked visually; English, Hindi and Gujarati at 100% key coverage.

### Phase 4: Payments (weeks 11–14)

- Razorpay orders, with payouts to each tenant through Razorpay Route
- Webhook with signature check and idempotency on `razorpay_event_id`, after which the report unlocks
- On return from Razorpay, one `GET /orders/:id` check sends the customer straight to the report
- GST invoice for each order in the tenant's name (FR-23)
- Tenant admin: lists of customers and orders, CSV export, revenue per month (FR-20)

**Gate:** a real ₹1 payment lands in a test tenant's account, and a replayed webhook doesn't unlock twice.

### Phase 5: Pilot hardening and launch (weeks 14–16)

- Daily backups kept 30 days, uptime monitoring, error tracking
- Load test on the PDF endpoint's concurrency limit
- GeoNames CC-BY credit and a public accuracy page
- Onboard the 3 pilot tenants

**Gate (MVP):** all 3 pilot tenants selling reports.

### v1.1

- 7 more languages, one at a time, each going live only when its keys are complete (FR-16)
- Kundli matching: Ashtakoota with all 8 kootas, Manglik compatibility for both people (FR-17)
- Daily panchang page, cached per city per day in Redis (FR-18)
- Custom domains with on-demand TLS certificates

### v1.2

- Tenant text overrides (`content_overrides`)
- Tenant subscription billing (depends on the pricing decision)
- Annual forecast (transits) report
- D2, D3, D7, D10, D12 charts

## Success metrics

The targets below are for 6 months after the MVP launch. They're placeholders until we have pilot data.

| Metric                                            | Target             |
| ------------------------------------------------- | ------------------ |
| Paying tenants                                    | 25                 |
| Reports sold per month, all tenants               | 5,000              |
| Tenant setup time, sign-up to first sale          | Under 1 day median |
| Visitor-to-paid conversion on tenant sites        | 3%                 |
| Share of reports in a language other than English | 50%                |
| Accuracy complaints confirmed as engine bugs      | 0 per month        |
| PDF generation p95                                | Under 10 s         |
| Infra cost per report                             | Under ₹0.50        |

## Risks

| Risk                                                       | Impact                            | Mitigation                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Engine results differ from the tools astrologers trust     | Tenants lose faith and churn      | Golden-chart test suite in CI; show degrees; public accuracy page                                                             |
| Content library is slow and costly to write and translate  | Languages ship late               | Write ~400 keys once in English; translate offline with IndicTrans2, then native review; 3 languages at launch (English, Hindi, Gujarati)                |
| Translation quality is poor in some scripts                | Customers distrust the report     | Native astrologer review required before a language goes live (FR-16)                                                         |
| Licence breach through an AGPL dependency                  | Forced to open-source or pay      | Licence check in CI; no Swiss Ephemeris                                                                                       |
| One tenant sees another tenant's data                      | Legal and trust damage            | Row-level security, cross-tenant test in CI, one query helper                                                                 |
| Birth data held without proper consent                     | Penalty under the DPDP Act        | Consent screen, export and delete, India hosting                                                                              |
| PDFs rendered in the request compete with API traffic      | Slow pages during download spikes | Warm browser, concurrency limit with 503 + retry, stored PDFs; split into its own HTTP service if the pilot shows it's needed |
| Workers process requests at Cloudflare's edge, and R2 has no India jurisdiction | DPDP residency claims ("hosted in India") may not hold for PDFs and in-flight data | Database and Redis in Mumbai, Smart Placement near the DB; confirm with counsel whether R2 storage of PDFs is acceptable, or keep PDFs only in Postgres/India storage |

## Open questions

- [ ] Frontend: keep Next.js (App Router, next-intl)?
- [ ] Pricing: does the platform take a percentage of each sale or a monthly fee per tenant? (Decides the Razorpay Route setup in Phase 4.)
- [ ] Who writes and reviews the master content library, and what does it cost?
- [x] MVP languages: English, Hindi and Gujarati (decided Nov 23, 2026).
- [ ] Do tenants need ayanamsas other than Lahiri (Raman, KP) at launch?
- [ ] Is the annual forecast report worth building before kundli matching?
