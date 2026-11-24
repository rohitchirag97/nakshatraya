import {
  boolean,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Tenant tables carry composite FKs (tenant_id, x_id) so a row can never point at another tenant's row,
// even by a guessed id. RLS policies live in the hand-written migration drizzle/0001_rls.sql.

export const roleEnum = pgEnum("role", ["owner", "astrologer", "customer"]);
export const chartStyleEnum = pgEnum("chart_style", ["north", "south"]);
export const reportStatusEnum = pgEnum("report_status", ["locked", "ready"]);
export const orderStatusEnum = pgEnum("order_status", ["created", "paid", "failed", "refunded"]);
export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);

const id = () => uuid("id").primaryKey().defaultRandom();
const tenantId = () => uuid("tenant_id").notNull();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// Not under RLS: middleware resolves the tenant from slug/domain before a tenant is known.
export const tenants = pgTable("tenants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  domain: text("domain").unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").notNull().default("#e5a322"),
  defaultLang: text("default_lang").notNull().default("en"),
  enabledLangs: text("enabled_langs").array().notNull().default(["en"]),
  chartStyle: chartStyleEnum("chart_style").notNull().default("north"),
  ayanamsa: text("ayanamsa").notNull().default("lahiri"),
  footerText: text("footer_text"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  kundliPricePaise: integer("kundli_price_paise").notNull().default(9900), // digital PDF
  printPricePaise: integer("print_price_paise").notNull().default(50000), // printed copy, PDF included
  // Features the tenant chose to offer. The shop and online consultation are not built yet; these
  // flags record the choice so the features switch on per tenant when they ship.
  shopEnabled: boolean("shop_enabled").notNull().default(false),
  consultEnabled: boolean("consult_enabled").notNull().default(false),
  // Payments. Set by the platform admin: commission in basis points (1000 = 10%) and the tenant's
  // Razorpay Route linked account ("acc_..."), which receives the rest of each sale.
  commissionBps: integer("commission_bps").notNull().default(1000),
  razorpayAccountId: text("razorpay_account_id"),
  // GST, set by the owner. No GSTIN = unregistered: invoices are bills of supply without tax lines.
  gstin: text("gstin"),
  legalName: text("legal_name"),
  address: text("address"),
  plan: text("plan").notNull().default("pilot"),
  // Prepaid platform wallet. Every kundli created costs the platform fee (platform income); with less
  // than that in the wallet, nobody on the tenant can create one. Changes only with a ledger row
  // (wallet_transactions), in the same transaction.
  walletPaise: integer("wallet_paise").notNull().default(0),
  // This tenant's fee per kundli; null = the platform-wide fee (platform_settings).
  reportFeePaise: integer("report_fee_paise"),
  createdAt: createdAt(),
});

// Platform-wide settings, one row. Set by the platform admin in /platform.
export const platformSettings = pgTable("platform_settings", {
  id: boolean("id").primaryKey().default(true), // always true: a single row
  reportFeePaise: integer("report_fee_paise").notNull().default(1000), // per kundli, from the wallet
});

// People who run the platform (our team). They log in to /platform with an OTP on this phone.
// Added only by `bun run platform:add-admin`; the app role can read but never write it.
export const platformAdmins = pgTable("platform_admins", {
  phone: text("phone").primaryKey(),
  createdAt: createdAt(),
});

// Astrologers asking to join, from the platform website. Platform-level (no tenant yet), so no RLS;
// only the platform admin API reads them.
export const tenantApplications = pgTable("tenant_applications", {
  id: id(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city").notNull(),
  preferredSlug: text("preferred_slug"),
  message: text("message"),
  // What they want to offer and charge; copied to the tenant on approval.
  wantsShop: boolean("wants_shop").notNull().default(false),
  wantsConsult: boolean("wants_consult").notNull().default(false),
  pdfPricePaise: integer("pdf_price_paise").notNull().default(9900),
  printPricePaise: integer("print_price_paise").notNull().default(50000),
  status: applicationStatusEnum("status").notNull().default("pending"),
  // Set on approval: the tenant created from this application.
  tenantId: uuid("tenant_id").references(() => tenants.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id),
    phone: text("phone").notNull(),
    email: text("email"),
    passwordHash: text("password_hash"),
    role: roleEnum("role").notNull().default("customer"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.tenantId, t.id), unique().on(t.tenantId, t.phone)],
);

// GeoNames import, shared by all tenants. id is the GeoNames id.
export const places = pgTable("places", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  altNames: text("alt_names").array().notNull().default([]),
  admin1: text("admin1"),
  country: text("country").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  tz: text("tz").notNull(),
  population: integer("population").notNull(),
});

export const profiles = pgTable(
  "profiles",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    gender: text("gender").notNull(),
    // Wall-clock time as entered; birth_utc is derived with historical tzdata.
    birthLocal: timestamp("birth_local", { mode: "string" }).notNull(),
    birthUtc: timestamp("birth_utc", { withTimezone: true }).notNull(),
    timeKnown: boolean("time_known").notNull(),
    placeId: integer("place_id").references(() => places.id),
    lat: doublePrecision("lat").notNull(),
    lon: doublePrecision("lon").notNull(),
    tz: text("tz").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    // Cascades below make DPDP account deletion one DELETE on users.
    foreignKey({
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("cascade"),
  ],
);

export const charts = pgTable(
  "charts",
  {
    id: id(),
    tenantId: tenantId(),
    profileId: uuid("profile_id").notNull(),
    engineVersion: text("engine_version").notNull(),
    resultJson: jsonb("result_json").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.profileId],
      foreignColumns: [profiles.tenantId, profiles.id],
    }).onDelete("cascade"),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    tenantId: tenantId(),
    chartId: uuid("chart_id").notNull(),
    type: text("type").notNull().default("kundli"),
    lang: text("lang").notNull(),
    status: reportStatusEnum("status").notNull().default("locked"),
    // Set on first download; the PDF is rendered in the request and stored.
    pdfKey: text("pdf_key"),
    // Report text frozen at creation (FR-13): later content edits never change an issued report.
    sections: jsonb("sections").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.chartId],
      foreignColumns: [charts.tenantId, charts.id],
    }).onDelete("cascade"),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    tenantId: tenantId(),
    // Nullable: orders are tax records and outlive a deleted customer's report (FK is SET NULL (report_id)).
    reportId: uuid("report_id"),
    amountPaise: integer("amount_paise").notNull(),
    razorpayOrderId: text("razorpay_order_id").unique(),
    // Unique so a replayed webhook can't apply twice.
    razorpayEventId: text("razorpay_event_id").unique(),
    status: orderStatusEnum("status").notNull().default("created"),
    // What was bought: the PDF, or a printed copy the tenant posts (PDF included).
    kind: text("kind", { enum: ["pdf", "print"] })
      .notNull()
      .default("pdf"),
    // Delivery address for printed copies: only what's needed to post it. Cleared if the buyer
    // deletes their account (the order itself stays as a tax record).
    shipName: text("ship_name"),
    shipPhone: text("ship_phone"),
    shipAddress: text("ship_address"),
    shipCity: text("ship_city"),
    shipState: text("ship_state"),
    shipPincode: text("ship_pincode"),
    trackingNo: text("tracking_no"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    // Buyer; nulled if they delete their account (the order stays as a tax record).
    userId: uuid("user_id"),
    // How it was paid: online via Razorpay, or recorded by staff for an offline sale.
    paymentMethod: text("payment_method", { enum: ["razorpay", "cash", "card", "upi", "other"] })
      .notNull()
      .default("razorpay"),
    paymentRef: text("payment_ref"), // offline: UPI ref, card slip, receipt no.
    recordedBy: uuid("recorded_by"), // staff member who recorded an offline payment
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    // Split and tax, fixed when the order is created (amount = commission + tenant share;
    // amount = taxable + gst, gst = 0 for unregistered tenants).
    commissionPaise: integer("commission_paise").notNull().default(0),
    taxablePaise: integer("taxable_paise").notNull().default(0),
    gstPaise: integer("gst_paise").notNull().default(0),
    invoiceNo: text("invoice_no"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.tenantId, t.invoiceNo),
    foreignKey({
      columns: [t.tenantId, t.reportId],
      foreignColumns: [reports.tenantId, reports.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("set null"),
    foreignKey({
      columns: [t.tenantId, t.recordedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("set null"),
  ],
);

// Wallet ledger: every change to tenants.wallet_paise. amount > 0 adds credit, < 0 is a platform
// fee. One report_fee per report (unique), so a retry can never charge twice.
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: id(),
    tenantId: tenantId().references(() => tenants.id),
    amountPaise: integer("amount_paise").notNull(),
    // topup | adjustment | report_fee; later: shop and consultation commission.
    kind: text("kind", { enum: ["topup", "adjustment", "report_fee"] }).notNull(),
    // Kept when the report is deleted (account deletion): the fee stays a fee.
    reportId: uuid("report_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.reportId, t.kind),
    foreignKey({
      columns: [t.tenantId, t.reportId],
      foreignColumns: [reports.tenantId, reports.id],
    }).onDelete("set null"),
  ],
);

// Online wallet recharges by the tenant owner, paid to the platform (no Route transfer).
export const walletTopups = pgTable("wallet_topups", {
  id: id(),
  tenantId: tenantId().references(() => tenants.id),
  amountPaise: integer("amount_paise").notNull(),
  razorpayOrderId: text("razorpay_order_id").notNull().unique(),
  razorpayPaymentId: text("razorpay_payment_id").unique(),
  status: text("status", { enum: ["created", "paid"] })
    .notNull()
    .default("created"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Gap-free invoice numbers per tenant per Indian financial year (GST rule: consecutive series).
export const invoiceCounters = pgTable(
  "invoice_counters",
  {
    tenantId: tenantId().references(() => tenants.id),
    fy: text("fy").notNull(), // "2627" = Apr 2026 to Mar 2027
    last: integer("last").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.fy] })],
);

// Master interpretation library, not tenant-scoped.
export const content = pgTable(
  "content",
  {
    key: text("key").notNull(),
    lang: text("lang").notNull(),
    text: text("text").notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.key, t.lang] })],
);
