import { zValidator } from "@hono/zod-validator";
import { charts, orders, profiles, reports, users } from "@jyotish/db";
import { and, count, desc, eq, sql, sum } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { anyUser, type Env, requireRole } from "./context";
import { cgstSgst } from "./money";

// shortcut: SAC 999799 ("other services n.e.c.") for astrology; confirm with the tenant's CA.
export const SAC = "999799";

const owner = requireRole("owner");

function orderRows(c: Context<Env>) {
  const t = c.get("tenant");
  return c.var.db.withTenant(t.id, (tx) =>
    tx
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        paidAt: orders.paidAt,
        status: orders.status,
        kind: orders.kind,
        invoiceNo: orders.invoiceNo,
        amountPaise: orders.amountPaise,
        gstPaise: orders.gstPaise,
        commissionPaise: orders.commissionPaise,
        phone: users.phone,
        lang: reports.lang,
        razorpayPaymentId: orders.razorpayPaymentId,
        paymentMethod: orders.paymentMethod,
        paymentRef: orders.paymentRef,
        name: profiles.name, // whose kundli: shown in the panel, not exported (free text)
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .leftJoin(reports, eq(reports.id, orders.reportId))
      .leftJoin(charts, eq(charts.id, reports.chartId))
      .leftJoin(profiles, eq(profiles.id, charts.profileId))
      .orderBy(desc(orders.createdAt))
      .limit(5000),
  );
}

// Every exported value is a date, number, enum, E.164 phone or our own id: no free text, so no
// spreadsheet formula injection.
const csvCell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rupees = (p: number) => (p / 100).toFixed(2);

// FR-20, owner only (FR-21: astrologers don't see sales).
export const salesRoutes = new Hono<Env>()
  .get("/orders", owner, async (c) => c.json(await orderRows(c)))

  .get("/orders.csv", owner, async (c) => {
    const head = [
      "created_at", "paid_at", "status", "kind", "invoice_no", "amount_inr", "gst_inr",
      "platform_commission_inr", "your_share_inr", "customer_phone", "report_lang", "razorpay_payment_id",
      "payment_method", "payment_ref",
    ]; // biome-ignore format: list
    const lines = (await orderRows(c)).map((o) =>
      [
        o.createdAt, o.paidAt, o.status, o.kind, o.invoiceNo, rupees(o.amountPaise), rupees(o.gstPaise),
        rupees(o.commissionPaise), rupees(o.amountPaise - o.commissionPaise), o.phone, o.lang,
        o.razorpayPaymentId, o.paymentMethod, o.paymentRef,
      ] // biome-ignore format: list
        .map(csvCell)
        .join(","),
    );
    c.header("content-type", "text/csv; charset=utf-8");
    c.header("content-disposition", `attachment; filename="orders-${c.get("tenant").slug}.csv"`);
    return c.body([head.join(","), ...lines].join("\n"));
  })

  .get("/revenue", owner, async (c) => {
    const t = c.get("tenant");
    const month = sql<string>`to_char(${orders.paidAt} at time zone 'Asia/Kolkata', 'YYYY-MM')`;
    const rows = await c.var.db.withTenant(t.id, (tx) =>
      tx
        .select({
          month,
          orders: count(),
          grossPaise: sum(orders.amountPaise).mapWith(Number),
          gstPaise: sum(orders.gstPaise).mapWith(Number),
          commissionPaise: sum(orders.commissionPaise).mapWith(Number),
        })
        .from(orders)
        .where(eq(orders.status, "paid"))
        .groupBy(month)
        .orderBy(desc(month)),
    );
    return c.json(rows.map((r) => ({ ...r, yourSharePaise: r.grossPaise - r.commissionPaise })));
  })

  // Printed copies to post: paid print orders, newest first, with the delivery address.
  .get("/fulfilment", owner, async (c) => {
    const t = c.get("tenant");
    const rows = await c.var.db.withTenant(t.id, (tx) =>
      tx
        .select({
          id: orders.id,
          paidAt: orders.paidAt,
          invoiceNo: orders.invoiceNo,
          reportId: orders.reportId,
          lang: reports.lang,
          shipName: orders.shipName,
          shipPhone: orders.shipPhone,
          shipAddress: orders.shipAddress,
          shipCity: orders.shipCity,
          shipState: orders.shipState,
          shipPincode: orders.shipPincode,
          trackingNo: orders.trackingNo,
          shippedAt: orders.shippedAt,
        })
        .from(orders)
        .leftJoin(reports, eq(reports.id, orders.reportId))
        .where(and(eq(orders.kind, "print"), eq(orders.status, "paid")))
        .orderBy(desc(orders.paidAt)),
    );
    return c.json(rows);
  })

  .post(
    "/orders/:id/shipped",
    owner,
    zValidator("json", z.object({ trackingNo: z.string().trim().max(60).optional() })),
    async (c) => {
      const t = c.get("tenant");
      const id = c.req.param("id");
      if (!z.uuid().safeParse(id).success) return c.json({ error: "not found" }, 404);
      const [o] = await c.var.db.withTenant(t.id, (tx) =>
        tx
          .update(orders)
          .set({ shippedAt: new Date(), trackingNo: c.req.valid("json").trackingNo || null })
          .where(and(eq(orders.id, id), eq(orders.kind, "print"), eq(orders.status, "paid")))
          .returning({ id: orders.id, shippedAt: orders.shippedAt, trackingNo: orders.trackingNo }),
      );
      return o ? c.json(o) : c.json({ error: "not found" }, 404);
    },
  )

  .get("/customers", owner, async (c) => {
    const t = c.get("tenant");
    const rows = await c.var.db.withTenant(t.id, (tx) =>
      tx
        .select({
          id: users.id,
          phone: users.phone,
          joined: users.createdAt,
          paidOrders:
            sql<number>`count(${orders.id}) filter (where ${orders.status} = 'paid')`.mapWith(
              Number,
            ),
          spentPaise:
            sql<number>`coalesce(sum(${orders.amountPaise}) filter (where ${orders.status} = 'paid'), 0)`.mapWith(
              Number,
            ),
        })
        .from(users)
        .leftJoin(orders, eq(orders.userId, users.id))
        .where(eq(users.role, "customer"))
        .groupBy(users.id)
        .orderBy(desc(users.createdAt)),
    );
    return c.json(rows);
  });

// A customer's own orders, and the invoice for a paid one (its buyer or the owner).
export const orderRoutes = new Hono<Env>()
  .get("/", anyUser, async (c) => {
    const s = c.get("session")!;
    return c.json(
      await c.var.db.withTenant(s.tenantId, (tx) =>
        tx
          .select({
            id: orders.id,
            status: orders.status,
            kind: orders.kind,
            amountPaise: orders.amountPaise,
            invoiceNo: orders.invoiceNo,
            reportId: orders.reportId,
            paidAt: orders.paidAt,
            shippedAt: orders.shippedAt,
            trackingNo: orders.trackingNo,
          })
          .from(orders)
          .where(eq(orders.userId, s.userId))
          .orderBy(desc(orders.createdAt)),
      ),
    );
  })

  .get("/:id", anyUser, async (c) => {
    const t = c.get("tenant");
    const s = c.get("session")!;
    const id = c.req.param("id");
    if (!z.uuid().safeParse(id).success) return c.json({ error: "not found" }, 404);
    const [row] = await c.var.db.withTenant(t.id, (tx) =>
      tx
        .select({ order: orders, lang: reports.lang })
        .from(orders)
        .leftJoin(reports, eq(reports.id, orders.reportId))
        .where(and(eq(orders.id, id), eq(orders.status, "paid"))),
    );
    if (!row || (row.order.userId !== s.userId && s.role !== "owner"))
      return c.json({ error: "not found" }, 404);
    const o = row.order;
    // The tax split is frozen on the order. shortcut: seller details are read live; snapshot them
    // onto the order if tenants start editing GSTIN or address after issuing invoices.
    const registered = o.gstPaise > 0;
    return c.json({
      kind: registered ? "tax-invoice" : "bill-of-supply",
      invoiceNo: o.invoiceNo,
      date: o.paidAt,
      seller: {
        name: t.legalName ?? t.name,
        tradeName: t.name,
        gstin: t.gstin,
        address: t.address,
        email: t.contactEmail,
        phone: t.contactPhone,
      },
      item: { kind: o.kind, lang: row.lang, sac: SAC, quantity: 1 },
      amountPaise: o.amountPaise,
      taxablePaise: o.taxablePaise,
      ...(registered ? cgstSgst(o.gstPaise) : { cgst: 0, sgst: 0 }),
      // Shown on the invoice as "Paid by": Cash / UPI · ref / Online · pay_… (never a test id).
      payment: {
        method: o.razorpayPaymentId?.startsWith("fake_pay_") ? "test" : o.paymentMethod,
        ref:
          o.paymentMethod === "razorpay"
            ? o.razorpayPaymentId?.startsWith("fake_pay_")
              ? null
              : o.razorpayPaymentId
            : o.paymentRef,
      },
    });
  });
