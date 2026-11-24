import { zValidator } from "@hono/zod-validator";
import { tenants, users } from "@jyotish/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { phone } from "./auth";
import { reviewedText } from "./content";
import { type Env, requireRole, session, type Tenant } from "./context";
import { GSTIN } from "./money";

// MVP languages. v1.1 adds ta, te, bn, mr, kn, ml. A language still goes live per tenant only once
// its report text is 100% reviewed (FR-16).
export const LANGS = ["en", "hi", "gu"] as const;

export const publicTenant = (t: Tenant) => ({
  slug: t.slug,
  name: t.name,
  logoUrl: t.logoUrl,
  brandColor: t.brandColor,
  defaultLang: t.defaultLang,
  enabledLangs: t.enabledLangs,
  chartStyle: t.chartStyle,
  footerText: t.footerText,
  contactEmail: t.contactEmail,
  contactPhone: t.contactPhone,
  kundliPricePaise: t.kundliPricePaise,
  printPricePaise: t.printPricePaise,
  shopEnabled: t.shopEnabled,
  consultEnabled: t.consultEnabled,
});

const settings = z
  .object({
    name: z.string().min(1).max(100),
    logoUrl: z.url({ protocol: /^https$/ }).nullable(),
    brandColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    defaultLang: z.enum(LANGS),
    enabledLangs: z.array(z.enum(LANGS)).min(1),
    chartStyle: z.enum(["north", "south"]),
    ayanamsa: z.literal("lahiri"), // others are an open question in the PRD
    footerText: z.string().max(500).nullable(),
    contactEmail: z.email().nullable(),
    contactPhone: phone.nullable(),
    kundliPricePaise: z.number().int().min(0).max(10_000_000),
    printPricePaise: z.number().int().min(0).max(10_000_000),
    shopEnabled: z.boolean(),
    consultEnabled: z.boolean(),
    // GST details for invoices (FR-23). No GSTIN = not registered: bills of supply, no tax lines.
    gstin: z.string().toUpperCase().regex(GSTIN, "not a valid GSTIN").nullable(),
    legalName: z.string().min(1).max(200).nullable(),
    address: z.string().min(1).max(500).nullable(),
  })
  .partial()
  .strict();

export const tenantRoutes = new Hono<Env>()
  .get("/", (c) => c.json(publicTenant(c.get("tenant"))))

  // Everything the owner can see about their own setup, including payment readiness.
  .get("/settings", requireRole("owner"), (c) => {
    const t = c.get("tenant");
    return c.json({
      ...publicTenant(t),
      gstin: t.gstin,
      legalName: t.legalName,
      address: t.address,
      commissionBps: t.commissionBps,
      paymentsReady: !!t.razorpayAccountId,
    });
  })

  .patch("/", requireRole("owner"), zValidator("json", settings), async (c) => {
    const t = c.get("tenant");
    const patch = c.req.valid("json");
    const enabled = patch.enabledLangs ?? t.enabledLangs;
    if (!enabled.includes(patch.defaultLang ?? t.defaultLang))
      return c.json({ error: "defaultLang must be one of enabledLangs" }, 400);
    // FR-16: a language goes live only when all its report text is reviewed.
    for (const lang of enabled.filter((l) => !t.enabledLangs.includes(l))) {
      const { missing } = await reviewedText(c.var.db.db, lang);
      if (missing.length)
        return c.json(
          { error: `report text for ${lang} is not complete`, missing: missing.length },
          400,
        );
    }
    const [updated] = await c.var.db.withTenant(t.id, (tx) =>
      tx.update(tenants).set(patch).where(eq(tenants.id, t.id)).returning(),
    );
    return c.json(publicTenant(updated!));
  })

  // FR-21: the owner adds astrologers (an existing customer with that phone is promoted).
  .post(
    "/staff",
    requireRole("owner"),
    zValidator("json", z.object({ phone, role: z.literal("astrologer") })),
    async (c) => {
      const tid = session(c).tenantId;
      const { phone, role } = c.req.valid("json");
      const [u] = await c.var.db.withTenant(tid, (tx) =>
        tx
          .insert(users)
          .values({ tenantId: tid, phone, role })
          .onConflictDoUpdate({ target: [users.tenantId, users.phone], set: { role } })
          .returning(),
      );
      return c.json({ id: u!.id, phone: u!.phone, role: u!.role }, 201);
    },
  );
