import { timingSafeEqual } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { platformAdmins, platformSettings, tenantApplications, tenants, users } from "@jyotish/db";
import { desc, eq, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { phone } from "./auth";
import { type Env, randomHex, rateLimit } from "./context";
import { sendSms } from "./sms";
import { credit } from "./wallet";

// Platform admin (us, not a tenant) and the public "apply to join" form. Both live on the platform's
// own host. People log in to the panel with an OTP on a phone in platform_admins; scripts can use
// PLATFORM_ADMIN_TOKEN as a bearer token instead.

const COOKIE = "padm";
const ADMIN_TTL = 12 * 3600;
const adminKey = (token: string) => `padm:${token}`;

const OTP_TTL = 300;
const otp = () =>
  String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");

async function isAdmin(c: Context<Env>, phone: string) {
  const [a] = await c.var.db.db
    .select({ phone: platformAdmins.phone })
    .from(platformAdmins)
    .where(eq(platformAdmins.phone, phone));
  return !!a;
}

const tokenOk = (want: string | undefined, got: string) =>
  !!want && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));

const clientIp = (c: Context<Env>) =>
  c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";

// Bearer token (scripts) or a 12 h OTP session; a session ends as soon as its phone is removed.
const adminOnly = createMiddleware<Env>(async (c, next) => {
  const bearer = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
  if (tokenOk(c.env.PLATFORM_ADMIN_TOKEN, bearer)) {
    c.set("adminPhone", "token");
    return next();
  }
  const sid = getCookie(c, COOKIE);
  const phone = sid ? await c.var.redis.get<string>(adminKey(sid)) : null;
  if (phone && (await isAdmin(c, phone))) {
    c.set("adminPhone", phone);
    return next();
  }
  return c.json({ error: "forbidden" }, 403);
});

const RESERVED = ["www", "api", "app", "admin", "mail", "static", "platform"];
export const slugSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/, "3-30 letters, digits or hyphens")
  .refine((s) => !RESERVED.includes(s), "reserved");

/** Tenant + owner in one transaction, so a failed owner insert never leaves an ownerless tenant. */
type Offer = Partial<
  Pick<
    typeof tenants.$inferInsert,
    "kundliPricePaise" | "printPricePaise" | "shopEnabled" | "consultEnabled"
  >
>;

async function createTenant(
  c: Context<Env>,
  slug: string,
  name: string,
  ownerPhone: string,
  offer: Offer = {},
) {
  const [taken] = await c.var.db.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug));
  if (taken) return null;
  return c.var.db.db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tenants)
      .values({ slug, name, ...offer })
      .returning();
    await tx.execute(sql`select set_config('app.tenant_id', ${t!.id}, true)`);
    await tx.insert(users).values({ tenantId: t!.id, phone: ownerPhone, role: "owner" });
    return t!.id;
  });
}

const price = z.number().int().min(0).max(10_000_000);

const tenantPatch = z
  .object({
    razorpayAccountId: z
      .string()
      .regex(/^acc_[A-Za-z0-9]+$/)
      .nullable(),
    commissionBps: z.number().int().min(0).max(10_000),
    name: z.string().min(1).max(100),
    // Custom domain (the tenant points its DNS at us); null to remove.
    domain: z
      .string()
      .toLowerCase()
      .regex(/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, "not a domain")
      .nullable(),
    plan: z.string().min(1).max(40),
    kundliPricePaise: price,
    printPricePaise: price,
    shopEnabled: z.boolean(),
    consultEnabled: z.boolean(),
    // null = follow the platform-wide fee.
    reportFeePaise: price.nullable(),
  })
  .partial()
  .strict();

export const adminRoutes = new Hono<Env>()
  // Login: OTP to a phone listed in platform_admins (added with `bun run platform:add-admin`).
  .post("/otp", zValidator("json", z.object({ phone })), async (c) => {
    const { phone } = c.req.valid("json");
    if (!(await rateLimit(c, `padm-otp:${clientIp(c)}`, 10, 900)))
      return c.json({ error: "too many requests, try again later" }, 429);
    const cooldown = await c.var.redis.set(`padm-otp-cd:${phone}`, "1", { ex: 30, nx: true });
    if (!cooldown) return c.json({ error: "wait 30 seconds before asking for a new code" }, 429);
    // Same answer whether or not the phone is an admin, so the form can't be used to find admins.
    if (!(await isAdmin(c, phone))) return c.json({ sent: true });
    const code = otp();
    await c.var.redis.set(`padm-otp:${phone}`, code, { ex: OTP_TTL });
    await c.var.redis.del(`padm-otp-try:${phone}`);
    // shortcut: no SMS provider yet. Outside production the code is also returned and shown on
    // screen; production sends it by SMS only (sendSms refuses until a provider is configured).
    await sendSms(c.env, phone, `${code} is your platform admin login code`);
    return c.json({ sent: true, ...(c.env.ENVIRONMENT !== "production" && { devCode: code }) });
  })
  .post(
    "/verify",
    zValidator("json", z.object({ phone, code: z.string().regex(/^\d{6}$/) })),
    async (c) => {
      const { phone, code } = c.req.valid("json");
      const tryKey = `padm-otp-try:${phone}`;
      const tries = await c.var.redis.incr(tryKey);
      if (tries === 1) await c.var.redis.expire(tryKey, OTP_TTL);
      if (tries > 5) {
        await c.var.redis.del(`padm-otp:${phone}`);
        return c.json({ error: "too many attempts, request a new code" }, 429);
      }
      const stored = await c.var.redis.get<string>(`padm-otp:${phone}`);
      if (!stored || !timingSafeEqual(Buffer.from(stored), Buffer.from(code)))
        return c.json({ error: "wrong or expired code" }, 401);
      await c.var.redis.del(`padm-otp:${phone}`);
      const sid = randomHex(32);
      await c.var.redis.set(adminKey(sid), phone, { ex: ADMIN_TTL });
      setCookie(c, COOKIE, sid, {
        httpOnly: true,
        secure: c.env.ENVIRONMENT === "production",
        sameSite: "Strict",
        path: "/",
        maxAge: ADMIN_TTL,
      });
      return c.json({ ok: true });
    },
  )
  .use(adminOnly)
  .get("/me", (c) => c.json({ phone: c.get("adminPhone") }))
  .post("/logout", async (c) => {
    const sid = getCookie(c, COOKIE);
    if (sid) await c.var.redis.del(adminKey(sid));
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  })

  // Every tenant with its owner and sales. Orders and users are under RLS, so the stats are read
  // tenant by tenant. shortcut: one query per tenant; move to a reporting view past ~100 tenants.
  .get("/tenants", async (c) => {
    const all = await c.var.db.db.select().from(tenants).orderBy(desc(tenants.createdAt));
    const [ps] = await c.var.db.db.select().from(platformSettings);
    const out = [];
    for (const t of all) {
      const [s] = await c.var.db.withTenant(t.id, (tx) =>
        tx.execute<{
          owner: string | null;
          paid: number;
          sales: number;
          reports: number;
          fees: number;
        }>(sql`
          select
            (select phone from users where role = 'owner' order by created_at limit 1) as owner,
            (select count(*)::int from orders where status = 'paid') as paid,
            (select coalesce(sum(amount_paise), 0)::int from orders where status = 'paid') as sales,
            (select count(*)::int from reports) as reports,
            (select coalesce(-sum(amount_paise), 0)::int from wallet_transactions where kind = 'report_fee') as fees`),
      );
      out.push({
        id: t.id,
        slug: t.slug,
        name: t.name,
        domain: t.domain,
        plan: t.plan,
        commissionBps: t.commissionBps,
        kundliPricePaise: t.kundliPricePaise,
        printPricePaise: t.printPricePaise,
        shopEnabled: t.shopEnabled,
        consultEnabled: t.consultEnabled,
        razorpayAccountId: t.razorpayAccountId,
        createdAt: t.createdAt,
        ownerPhone: s?.owner ?? null,
        paidOrders: s?.paid ?? 0,
        salesPaise: s?.sales ?? 0,
        reports: s?.reports ?? 0,
        walletPaise: t.walletPaise,
        reportFeePaise: t.reportFeePaise, // override, or null
        effectiveFeePaise: t.reportFeePaise ?? ps?.reportFeePaise ?? 1000,
        feesPaise: s?.fees ?? 0,
      });
    }
    return c.json(out);
  })

  .post(
    "/tenants",
    zValidator(
      "json",
      z.object({
        slug: slugSchema,
        name: z.string().min(1).max(100),
        ownerPhone: phone,
        kundliPricePaise: price.optional(),
        printPricePaise: price.optional(),
        shopEnabled: z.boolean().optional(),
        consultEnabled: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const { slug, name, ownerPhone, ...offer } = c.req.valid("json");
      const id = await createTenant(c, slug, name, ownerPhone, offer);
      if (!id) return c.json({ error: "slug taken" }, 409);
      return c.json({ id, slug }, 201);
    },
  )

  .patch("/tenants/:slug", zValidator("json", tenantPatch), async (c) => {
    const [t] = await c.var.db.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, c.req.param("slug")));
    if (!t) return c.json({ error: "not found" }, 404);
    const patch = c.req.valid("json");
    if (patch.domain) {
      const [other] = await c.var.db.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.domain, patch.domain));
      if (other && other.id !== t.id)
        return c.json({ error: "domain used by another tenant" }, 409);
      if (patch.domain.endsWith(`.${c.env.APP_DOMAIN}`) || patch.domain === c.env.APP_DOMAIN)
        return c.json({ error: "use the subdomain, not a custom domain, for our own domain" }, 400);
    }
    const [u] = await c.var.db.withTenant(t.id, (tx) =>
      tx.update(tenants).set(patch).where(eq(tenants.id, t.id)).returning(),
    );
    return c.json({
      slug: u!.slug,
      name: u!.name,
      domain: u!.domain,
      plan: u!.plan,
      razorpayAccountId: u!.razorpayAccountId,
      commissionBps: u!.commissionBps,
      kundliPricePaise: u!.kundliPricePaise,
      printPricePaise: u!.printPricePaise,
      shopEnabled: u!.shopEnabled,
      consultEnabled: u!.consultEnabled,
      reportFeePaise: u!.reportFeePaise,
    });
  })

  // Platform-wide settings: the fee every kundli costs from a tenant's wallet (unless overridden).
  .get("/settings", async (c) => {
    const [s] = await c.var.db.db.select().from(platformSettings);
    return c.json({ reportFeePaise: s?.reportFeePaise ?? 1000 });
  })
  .patch(
    "/settings",
    zValidator("json", z.object({ reportFeePaise: price }).strict()),
    async (c) => {
      const [s] = await c.var.db.db.update(platformSettings).set(c.req.valid("json")).returning();
      return c.json({ reportFeePaise: s!.reportFeePaise });
    },
  )

  // Wallet credit after the tenant pays us (UPI / bank). Negative = correction.
  .post(
    "/tenants/:slug/credit",
    zValidator(
      "json",
      z.object({
        amountPaise: z
          .number()
          .int()
          .min(-10_000_000)
          .max(10_000_000)
          .refine((n) => n !== 0),
        note: z.string().trim().max(200).nullable().optional(),
      }),
    ),
    async (c) => {
      const [t] = await c.var.db.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, c.req.param("slug")));
      if (!t) return c.json({ error: "not found" }, 404);
      const { amountPaise, note } = c.req.valid("json");
      // The note is shown to the tenant, so it never carries the admin's phone.
      const balancePaise = await c.var.db.withTenant(t.id, (tx) =>
        credit(tx, t.id, amountPaise, amountPaise > 0 ? "topup" : "adjustment", note || null),
      );
      return c.json({ balancePaise });
    },
  )

  .get("/applications", async (c) =>
    c.json(
      await c.var.db.db
        .select()
        .from(tenantApplications)
        .orderBy(desc(tenantApplications.createdAt))
        .limit(500),
    ),
  )

  // Approve = create the tenant (owner = the applicant's phone) and link it to the application.
  .post(
    "/applications/:id/approve",
    zValidator("json", z.object({ slug: slugSchema, name: z.string().min(1).max(100).optional() })),
    async (c) => {
      const appId = c.req.param("id");
      if (!z.uuid().safeParse(appId).success) return c.json({ error: "not found" }, 404);
      const [a] = await c.var.db.db
        .select()
        .from(tenantApplications)
        .where(eq(tenantApplications.id, appId));
      if (!a) return c.json({ error: "not found" }, 404);
      if (a.status !== "pending") return c.json({ error: `already ${a.status}` }, 409);
      const { slug, name } = c.req.valid("json");
      const id = await createTenant(c, slug, name ?? a.businessName, a.phone, {
        kundliPricePaise: a.pdfPricePaise,
        printPricePaise: a.printPricePaise,
        shopEnabled: a.wantsShop,
        consultEnabled: a.wantsConsult,
      });
      if (!id) return c.json({ error: "slug taken" }, 409);
      await c.var.db.db
        .update(tenantApplications)
        .set({ status: "approved", tenantId: id, decidedAt: new Date() })
        .where(eq(tenantApplications.id, a.id));
      return c.json({ id, slug }, 201);
    },
  )

  .post("/applications/:id/reject", async (c) => {
    const appId = c.req.param("id");
    if (!z.uuid().safeParse(appId).success) return c.json({ error: "not found" }, 404);
    const [a] = await c.var.db.db
      .update(tenantApplications)
      .set({ status: "rejected", decidedAt: new Date() })
      .where(sql`${tenantApplications.id} = ${appId} and ${tenantApplications.status} = 'pending'`)
      .returning({ id: tenantApplications.id });
    if (!a) return c.json({ error: "not found or already decided" }, 404);
    return c.json({ ok: true });
  });

// Public: astrologers apply to join from the platform website.
export const applyRoutes = new Hono<Env>().post(
  "/",
  zValidator(
    "json",
    z.object({
      businessName: z.string().trim().min(2).max(100),
      contactName: z.string().trim().min(2).max(100),
      phone,
      email: z.email().max(200).nullable().optional(),
      city: z.string().trim().min(2).max(80),
      preferredSlug: slugSchema.nullable().optional(),
      wantsShop: z.boolean().default(false),
      wantsConsult: z.boolean().default(false),
      pdfPricePaise: price.default(9900),
      printPricePaise: price.default(50000),
      message: z.string().trim().max(1000).nullable().optional(),
    }),
  ),
  async (c) => {
    if (!(await rateLimit(c, `apply:${clientIp(c)}`, 5, 3600)))
      return c.json({ error: "too many applications, try again later" }, 429);
    const v = c.req.valid("json");
    const [dup] = await c.var.db.db
      .select({ id: tenantApplications.id })
      .from(tenantApplications)
      .where(
        sql`${tenantApplications.phone} = ${v.phone} and ${tenantApplications.status} = 'pending'`,
      );
    if (dup) return c.json({ error: "you have already applied; we will call you soon" }, 409);
    await c.var.db.db.insert(tenantApplications).values({
      ...v,
      email: v.email ?? null,
      preferredSlug: v.preferredSlug ?? null,
      message: v.message || null,
    });
    return c.json({ ok: true }, 201);
  },
);
