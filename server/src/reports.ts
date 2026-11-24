import { zValidator } from "@hono/zod-validator";
import { charts, places, profiles, reports } from "@jyotish/db";
import { assembleSections, type Chart, computeChart } from "@jyotish/engine";
import { and, desc, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { reviewedText } from "./content";
import { anyUser, type Bindings, type Env, type Session, tenantHost } from "./context";
import { printLayout } from "./print";
import { checkPrintToken, printToken } from "./print-token";
import { findProfile } from "./profiles";
import { LANGS, publicTenant } from "./tenant";
import { chargeReportFee, reportFee, WalletEmpty } from "./wallet";

/** Chromium via Cloudflare Browser Rendering. An object so tests can swap the renderer. */
export const pdf = {
  async render(
    browser: Bindings["BROWSER"],
    url: string,
    size: "a4" | "a5" = "a4",
  ): Promise<Uint8Array<ArrayBuffer>> {
    // Dynamic import: the package only loads inside workerd.
    const { launch } = await import("@cloudflare/playwright");
    const b = await launch(browser);
    try {
      const page = await b.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready); // Indic shaping needs the Noto fonts loaded
      const out = await page.pdf({
        format: size === "a5" ? "A5" : "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
      return new Uint8Array(out);
    } finally {
      await b.close();
    }
  },
};

export const staffRole = (s: Session | null) => !!s && s.role !== "customer";

/** The report if this request may see it: its customer, tenant staff, or a valid print token. */
export async function loadReport(c: Context<Env>, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const t = c.get("tenant");
  const s = c.get("session");
  const token = c.req.query("t");
  const viaToken = !!token && (await checkPrintToken(c.env.REPORT_TOKEN_SECRET, t.id, id, token));
  if (!s && !viaToken) return null;

  const [row] = await c.var.db.withTenant(t.id, (tx) =>
    tx
      .select({ report: reports, chart: charts, profile: profiles })
      .from(reports)
      .innerJoin(charts, eq(charts.id, reports.chartId))
      .innerJoin(profiles, eq(profiles.id, charts.profileId))
      .where(eq(reports.id, id)),
  );
  if (!row) return null;
  const mayView = viaToken || staffRole(s) || row.profile.userId === s?.userId;
  return mayView ? { ...row, viaToken } : null;
}

/** 402 when the tenant's wallet can't pay the platform fee. Customers aren't told about wallets. */
const walletEmpty = (c: Context<Env>, staff: boolean) =>
  c.json(
    {
      error: staff
        ? "Your wallet balance is too low to create a kundli. Please recharge."
        : `Kundli creation is unavailable right now. Please contact ${c.get("tenant").name}.`,
      code: "wallet_empty",
      staff,
    },
    402,
  );

const locked = (c: Context<Env>, r: { report: { status: string }; viaToken: boolean }) =>
  r.report.status === "locked" && !r.viaToken && !staffRole(c.get("session"));

export const reportRoutes = new Hono<Env>()
  .post(
    "/",
    anyUser,
    zValidator("json", z.object({ profileId: z.uuid(), lang: z.enum(LANGS) })),
    async (c) => {
      const t = c.get("tenant");
      const s = c.get("session")!;
      const { profileId, lang } = c.req.valid("json");
      if (!t.enabledLangs.includes(lang)) return c.json({ error: "language not enabled" }, 400);
      const profile = await findProfile(c.var.db, s, profileId);
      if (!profile) return c.json({ error: "profile not found" }, 404);

      const staff = staffRole(s);
      // Customer clicking "Get kundli" again for the same person: reuse the unpaid one, so the
      // tenant isn't charged the platform fee twice.
      if (!staff) {
        const [open] = await c.var.db.withTenant(t.id, (tx) =>
          tx
            .select({ id: reports.id, status: reports.status })
            .from(reports)
            .innerJoin(charts, eq(charts.id, reports.chartId))
            .where(
              and(
                eq(charts.profileId, profileId),
                eq(reports.lang, lang),
                eq(reports.status, "locked"),
              ),
            )
            .limit(1),
        );
        if (open) return c.json(open, 200);
      }
      const fee = await reportFee(c.var.db, t);
      if (t.walletPaise < fee) return walletEmpty(c, staff);

      const { text, missing } = await reviewedText(c.var.db.db, lang);
      if (missing.length)
        return c.json(
          { error: "report text for this language is not complete", missing: missing.length },
          409,
        );

      const chart = computeChart({
        utc: profile.birthUtc,
        lat: profile.lat,
        lon: profile.lon,
        timeKnown: profile.timeKnown,
      });
      const sections = assembleSections(chart, new Date(), text);
      let report: { id: string; status: "locked" | "ready" };
      try {
        report = await c.var.db.withTenant(t.id, async (tx) => {
          const [ch] = await tx
            .insert(charts)
            .values({
              tenantId: t.id,
              profileId,
              engineVersion: chart.engineVersion,
              resultJson: chart,
            })
            .returning({ id: charts.id });
          const [r] = await tx
            .insert(reports)
            .values({
              tenantId: t.id,
              chartId: ch!.id,
              lang,
              // Customers' reports unlock on payment; staff reports (FR-21) and a ₹0 price are free.
              status: staff || t.kundliPricePaise === 0 ? "ready" : "locked",
              sections,
            })
            .returning({ id: reports.id, status: reports.status });
          // Platform fee, in the same transaction: no balance, no report.
          await chargeReportFee(tx, t.id, r!.id, fee);
          return r!;
        });
      } catch (e) {
        if (e instanceof WalletEmpty) return walletEmpty(c, staff);
        throw e;
      }
      return c.json(report, 201);
    },
  )

  .get("/", anyUser, async (c) => {
    const s = c.get("session")!;
    const rows = await c.var.db.withTenant(s.tenantId, (tx) =>
      tx
        .select({
          id: reports.id,
          status: reports.status,
          lang: reports.lang,
          createdAt: reports.createdAt,
          name: profiles.name,
          profileId: profiles.id,
        })
        .from(reports)
        .innerJoin(charts, eq(charts.id, reports.chartId))
        .innerJoin(profiles, eq(profiles.id, charts.profileId))
        .where(s.role === "customer" ? eq(profiles.userId, s.userId) : undefined)
        .orderBy(desc(reports.createdAt)),
    );
    return c.json(rows);
  })

  .get("/:id", async (c) => {
    const r = await loadReport(c, c.req.param("id"));
    if (!r) return c.json({ error: "not found" }, 404);
    const t = c.get("tenant");
    if (locked(c, r))
      return c.json({ error: "payment required", pricePaise: t.kundliPricePaise }, 402);
    const [place] = r.profile.placeId
      ? await c.var.db.db.select().from(places).where(eq(places.id, r.profile.placeId))
      : [];
    return c.json({
      id: r.report.id,
      lang: r.report.lang,
      status: r.report.status,
      createdAt: r.report.createdAt,
      tenant: publicTenant(t),
      profile: {
        name: r.profile.name,
        gender: r.profile.gender,
        birthLocal: r.profile.birthLocal,
        timeKnown: r.profile.timeKnown,
        tz: r.profile.tz,
        lat: r.profile.lat,
        lon: r.profile.lon,
        place: place ? { name: place.name, admin1: place.admin1, country: place.country } : null,
      },
      chart: r.chart.resultJson as Chart,
      sections: r.report.sections,
    });
  })

  // ?size=a5 (own A5 layout), ?cover=0 (astrologer's own cover), ?layout=booklet (A5 pages two per
  // A4 sheet in fold order). Print options are for tenant staff; they open inline for the preview.
  .get("/:id/pdf", async (c) => {
    const r = await loadReport(c, c.req.param("id"));
    if (!r || r.viaToken) return c.json({ error: "not found" }, 404);
    const t = c.get("tenant");
    if (locked(c, r))
      return c.json({ error: "payment required", pricePaise: t.kundliPricePaise }, 402);

    const q = c.req.query();
    const size = q.size === "a5" ? "a5" : "a4";
    const cover = q.cover !== "0";
    const booklet = q.layout === "booklet";
    const bw = q.color === "bw"; // black-and-white printers: no paper texture, shading or colour
    const custom = size !== "a4" || !cover || booklet || bw;
    if (custom && !staffRole(c.get("session")))
      return c.json({ error: "print options are for the astrologer" }, 403);
    if (booklet && size !== "a5") return c.json({ error: "booklets are A5" }, 400);

    const name = `kundli-${r.report.id.slice(0, 8)}${custom ? `-${size}${booklet ? "-booklet" : ""}${bw ? "-bw" : ""}` : ""}.pdf`;
    const headers = {
      "content-type": "application/pdf",
      "content-disposition": `${custom ? "inline" : "attachment"}; filename="${name}"`,
    };

    // One rendered PDF per size, kept in R2; cover removal and booklet order are applied to it.
    const key = `${t.id}/${r.report.id}/${r.chart.engineVersion}-${r.report.lang}${size === "a5" ? "-a5" : ""}${bw ? "-bw" : ""}.pdf`;
    let bytes: Uint8Array<ArrayBuffer> | null = null;
    const stored = await c.env.REPORTS.get(size === "a4" && !bw ? (r.report.pdfKey ?? key) : key);
    if (stored)
      bytes = new Uint8Array(
        await new Response(stored.body as unknown as ReadableStream).arrayBuffer(),
      );
    if (!bytes) {
      const token = await printToken(c.env.REPORT_TOKEN_SECRET, t.id, r.report.id);
      const url = `${c.env.WEB_ORIGIN.replace("{host}", tenantHost(c))}/report/${r.report.id}?t=${token}${size === "a5" ? "&size=a5" : ""}${bw ? "&bw=1" : ""}`;
      try {
        bytes = await pdf.render(c.env.BROWSER, url, size);
      } catch (e) {
        // Browser Rendering caps concurrent browsers per account; ask the client to retry, don't 500.
        if (/429|rate limit|too many/i.test(String(e)))
          return c.json({ error: "busy, retry in a moment" }, 503, { "retry-after": "5" });
        throw e;
      }
      await c.env.REPORTS.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
      if (size === "a4" && !bw)
        await c.var.db.withTenant(t.id, (tx) =>
          tx
            .update(reports)
            .set({ pdfKey: key })
            .where(and(eq(reports.id, r.report.id), eq(reports.tenantId, t.id))),
        );
    }
    if (custom) bytes = await printLayout(bytes, { cover, booklet });
    return new Response(bytes, { headers });
  });
