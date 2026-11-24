import { zValidator } from "@hono/zod-validator";
import { type Db, invoiceCounters, orders, reports, type Tx, tenants } from "@jyotish/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { phone } from "./auth";
import { anyUser, type Bindings, type Env, staff } from "./context";
import { hmacSha256, safeEqual } from "./hmac";
import { financialYear, invoiceNumber, splitAmount } from "./money";
import { loadReport } from "./reports";
import { markTopupPaid } from "./wallet";

const MIN_PAISE = 100; // Razorpay's minimum order is ₹1

/**
 * Local test payments: "Pay" marks the order paid without Razorpay. Needs DEV_FAKE_PAYMENTS=1 *and* a
 * non-production environment; the production wrangler env sets neither, so it can't switch on there.
 */
export const fakePayments = (env: Bindings) =>
  env.DEV_FAKE_PAYMENTS === "1" && env.ENVIRONMENT !== "production";

/** Razorpay REST client. An object so tests can swap it. */
export const razorpay = {
  async createOrder(env: Bindings, body: Record<string, unknown>): Promise<{ id: string }> {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`razorpay order ${res.status}: ${await res.text()}`);
    return res.json();
  },
};

/** Next number in the tenant's gap-free invoice series for this financial year (GST rule). */
export async function nextInvoiceNo(tx: Tx, tenantId: string) {
  const fy = financialYear(new Date());
  const [ctr] = await tx
    .insert(invoiceCounters)
    .values({ tenantId, fy, last: 1 })
    .onConflictDoUpdate({
      target: [invoiceCounters.tenantId, invoiceCounters.fy],
      set: { last: sql`${invoiceCounters.last} + 1` },
    })
    .returning();
  return invoiceNumber(fy, ctr!.last);
}

type PaidResult = "paid" | "already" | "unknown" | "mismatch";

/**
 * The one place an order becomes paid: allocate the next invoice number and unlock the report, in one
 * transaction. Safe to call twice (checkout callback and webhook both do): the row lock serialises them.
 */
export function markPaid(
  { withTenant }: Db,
  tenantId: string,
  p: { razorpayOrderId: string; paymentId: string; amount?: number; eventId?: string },
): Promise<PaidResult> {
  return withTenant(tenantId, async (tx) => {
    const [o] = await tx
      .select()
      .from(orders)
      .where(eq(orders.razorpayOrderId, p.razorpayOrderId))
      .for("update");
    if (!o) return "unknown";
    if (o.status === "paid") return "already";
    if (p.amount !== undefined && p.amount !== o.amountPaise) return "mismatch";

    const invoiceNo = await nextInvoiceNo(tx, tenantId);
    await tx
      .update(orders)
      .set({
        status: "paid",
        razorpayPaymentId: p.paymentId,
        razorpayEventId: p.eventId ?? null,
        paidAt: new Date(),
        invoiceNo,
      })
      .where(eq(orders.id, o.id));
    if (o.reportId)
      await tx.update(reports).set({ status: "ready" }).where(eq(reports.id, o.reportId));
    return "paid";
  });
}

const orderBody = z
  .object({
    kind: z.enum(["pdf", "print"]).default("pdf"),
    ship: z
      .object({
        name: z.string().trim().min(1).max(100),
        phone,
        address: z.string().trim().min(5).max(300),
        city: z.string().trim().min(1).max(80),
        state: z.string().trim().min(1).max(80),
        pincode: z.string().regex(/^[1-9]\d{5}$/, "6-digit PIN code"),
      })
      .optional(),
  })
  .refine((b) => b.kind === "pdf" || b.ship, {
    message: "delivery address required",
    path: ["ship"],
  });

// Customer-facing routes (tenant host, logged in).
const offlineBody = z.object({
  kind: z.enum(["pdf", "print"]),
  amountPaise: z.number().int().min(MIN_PAISE).max(10_000_000),
  method: z.enum(["cash", "card", "upi", "other"]),
  // Letters, digits and a few separators only: it goes into the CSV export (no formula injection).
  reference: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9 ./_-]{0,39}$/, "letters, digits, space . / _ - only")
    .optional()
    .or(z.literal("")),
});

export const paymentRoutes = new Hono<Env>()
  // Start paying: one Razorpay order, tenant's share routed to their account. "pdf" unlocks a
  // locked report; "print" (PDF included) also needs a delivery address and can follow a PDF purchase.
  .post("/reports/:id/order", anyUser, async (c) => {
    const t = c.get("tenant");
    const s = c.get("session")!;
    const parsed = orderBody.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success)
      return c.json({ error: "invalid order details", issues: parsed.error.issues }, 400);
    const { kind, ship } = parsed.data;
    const r = await loadReport(c, c.req.param("id"));
    if (!r) return c.json({ error: "not found" }, 404);
    if (kind === "pdf" && r.report.status !== "locked")
      return c.json({ error: "report is already unlocked" }, 409);
    const amount = kind === "print" ? t.printPricePaise : t.kundliPricePaise;
    if (amount < MIN_PAISE) return c.json({ error: "price not set" }, 409);
    const fake = fakePayments(c.env);
    if (!t.razorpayAccountId && !fake)
      return c.json({ error: "this astrologer can't accept payments yet" }, 409);

    const checkout = (razorpayOrderId: string, orderId: string, amount: number) =>
      c.json({
        orderId,
        razorpayOrderId,
        keyId: c.env.RAZORPAY_KEY_ID,
        amount,
        currency: "INR",
        name: t.name,
        fake,
      });

    // Reuse an unpaid PDF order for the same report and price instead of opening a second one
    // (print orders carry an address, so each checkout gets its own).
    const [open] =
      kind === "pdf"
        ? await c.var.db.withTenant(t.id, (tx) =>
            tx
              .select()
              .from(orders)
              .where(
                and(
                  eq(orders.reportId, r.report.id),
                  eq(orders.status, "created"),
                  eq(orders.kind, "pdf"),
                  eq(orders.amountPaise, amount),
                ),
              )
              .orderBy(desc(orders.createdAt))
              .limit(1),
          )
        : [];
    if (open?.razorpayOrderId) return checkout(open.razorpayOrderId, open.id, open.amountPaise);

    const split = splitAmount(amount, t.commissionBps, !!t.gstin);
    const orderId = crypto.randomUUID();
    const notes = { tenant_id: t.id, order_id: orderId, report_id: r.report.id, kind };
    let rz: { id: string };
    try {
      rz = fake
        ? { id: `fake_order_${orderId}` }
        : await razorpay.createOrder(c.env, {
            amount,
            currency: "INR",
            receipt: orderId,
            notes,
            transfers: [
              {
                account: t.razorpayAccountId,
                amount: split.tenantShare,
                currency: "INR",
                notes,
                on_hold: false,
              },
            ],
          });
    } catch (e) {
      console.error(e); // bad keys, unknown linked account, Razorpay down: nothing was charged
      return c.json({ error: "payment service unavailable, please try again shortly" }, 502);
    }
    await c.var.db.withTenant(t.id, (tx) =>
      tx.insert(orders).values({
        id: orderId,
        tenantId: t.id,
        reportId: r.report.id,
        userId: s.userId,
        amountPaise: amount,
        kind,
        ...(ship && {
          shipName: ship.name,
          shipPhone: ship.phone,
          shipAddress: ship.address,
          shipCity: ship.city,
          shipState: ship.state,
          shipPincode: ship.pincode,
        }),
        razorpayOrderId: rz.id,
        commissionPaise: split.commission,
        taxablePaise: split.taxable,
        gstPaise: split.gst,
      }),
    );
    return checkout(rz.id, orderId, amount);
  })

  // Offline sale (cash, card or UPI at the counter), recorded by staff: a paid order with the next
  // invoice number, and the kundli unlocks. No platform commission: the money never passed through
  // us (the kundli fee was already taken from the wallet).
  .post("/reports/:id/offline-payment", staff, zValidator("json", offlineBody), async (c) => {
    const t = c.get("tenant");
    const s = c.get("session")!;
    const r = await loadReport(c, c.req.param("id"));
    if (!r) return c.json({ error: "not found" }, 404);
    const { kind, amountPaise, method, reference } = c.req.valid("json");
    const split = splitAmount(amountPaise, 0, !!t.gstin);

    const result = await c.var.db.withTenant(t.id, async (tx) => {
      // The report row lock serialises two staff recording the same PDF sale at once.
      await tx
        .select({ id: reports.id })
        .from(reports)
        .where(eq(reports.id, r.report.id))
        .for("update");
      if (kind === "pdf") {
        const [paid] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.reportId, r.report.id),
              eq(orders.kind, "pdf"),
              eq(orders.status, "paid"),
            ),
          );
        if (paid) return null;
      }
      const invoiceNo = await nextInvoiceNo(tx, t.id);
      const now = new Date();
      const [o] = await tx
        .insert(orders)
        .values({
          tenantId: t.id,
          reportId: r.report.id,
          userId: r.profile.userId,
          kind,
          amountPaise,
          status: "paid",
          paidAt: now,
          paymentMethod: method,
          paymentRef: reference || null,
          recordedBy: s.userId,
          commissionPaise: 0,
          taxablePaise: split.taxable,
          gstPaise: split.gst,
          invoiceNo,
          // Handed over at the counter: nothing to post.
          shippedAt: kind === "print" ? now : null,
        })
        .returning({ id: orders.id, invoiceNo: orders.invoiceNo });
      await tx.update(reports).set({ status: "ready" }).where(eq(reports.id, r.report.id));
      return o!;
    });
    if (!result) return c.json({ error: "this kundli's PDF is already paid" }, 409);
    return c.json({ orderId: result.id, invoiceNo: result.invoiceNo }, 201);
  })

  // Checkout success callback: Razorpay's signature proves the payment, so unlock straight away
  // (the webhook does the same and is a no-op if this ran first).
  .post(
    "/orders/verify",
    anyUser,
    zValidator(
      "json",
      z.object({
        razorpay_order_id: z.string().min(1),
        razorpay_payment_id: z.string().min(1),
        razorpay_signature: z.string().min(1),
      }),
    ),
    async (c) => {
      const b = c.req.valid("json");
      const want = await hmacSha256(
        c.env.RAZORPAY_KEY_SECRET,
        `${b.razorpay_order_id}|${b.razorpay_payment_id}`,
        "hex",
      );
      if (!safeEqual(b.razorpay_signature, want)) return c.json({ error: "bad signature" }, 400);
      const result = await markPaid(c.var.db, c.get("tenant").id, {
        razorpayOrderId: b.razorpay_order_id,
        paymentId: b.razorpay_payment_id,
      });
      if (result === "unknown") return c.json({ error: "order not found" }, 404);
      const [o] = await c.var.db.withTenant(c.get("tenant").id, (tx) =>
        tx
          .select({ id: orders.id, reportId: orders.reportId })
          .from(orders)
          .where(eq(orders.razorpayOrderId, b.razorpay_order_id)),
      );
      return c.json({ status: "paid", orderId: o!.id, reportId: o!.reportId });
    },
  )

  // Local test payments only (see fakePayments): marks the buyer's own order paid, no money moves.
  .post(
    "/orders/fake-pay",
    anyUser,
    zValidator("json", z.object({ razorpayOrderId: z.string().startsWith("fake_order_") })),
    async (c) => {
      if (!fakePayments(c.env)) return c.json({ error: "not found" }, 404);
      const t = c.get("tenant");
      const s = c.get("session")!;
      const { razorpayOrderId } = c.req.valid("json");
      const [o] = await c.var.db.withTenant(t.id, (tx) =>
        tx
          .select({ id: orders.id, reportId: orders.reportId })
          .from(orders)
          .where(and(eq(orders.razorpayOrderId, razorpayOrderId), eq(orders.userId, s.userId))),
      );
      if (!o) return c.json({ error: "order not found" }, 404);
      await markPaid(c.var.db, t.id, {
        razorpayOrderId,
        paymentId: `fake_pay_${crypto.randomUUID()}`,
      });
      return c.json({ status: "paid", orderId: o.id, reportId: o.reportId });
    },
  );

const webhookBody = z.object({
  event: z.string(),
  payload: z.object({
    order: z.object({
      entity: z.object({ id: z.string(), notes: z.record(z.string(), z.unknown()) }),
    }),
    payment: z.object({ entity: z.object({ id: z.string(), amount: z.number() }) }),
  }),
});

// Razorpay → us. One URL for all tenants: the tenant comes from the order notes we set, which the
// signature makes trustworthy. Answers 2xx for anything we've handled so Razorpay stops retrying.
export const webhookRoutes = new Hono<Env>().post("/", async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header("x-razorpay-signature") ?? "";
  const want = await hmacSha256(c.env.RAZORPAY_WEBHOOK_SECRET, raw, "hex");
  if (!safeEqual(sig, want)) return c.json({ error: "bad signature" }, 400);

  const body = JSON.parse(raw);
  if (body.event !== "order.paid") return c.json({ ignored: body.event });
  const parsed = webhookBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "unexpected payload" }, 400);
  const { order, payment } = parsed.data.payload;
  const tenantId = order.entity.notes.tenant_id;
  if (typeof tenantId !== "string" || !z.uuid().safeParse(tenantId).success)
    return c.json({ ignored: "no tenant" });
  const [exists] = await c.var.db.db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  if (!exists) return c.json({ ignored: "unknown tenant" });

  // Wallet recharge (paid to the platform) vs. a customer's kundli order.
  if (order.entity.notes.purpose === "wallet") {
    const r = await markTopupPaid(c.var.db, tenantId, {
      razorpayOrderId: order.entity.id,
      paymentId: payment.entity.id,
      amount: payment.entity.amount,
    });
    if (r === "mismatch") console.error(`webhook amount mismatch for topup ${order.entity.id}`);
    return c.json({ result: r });
  }

  const result = await markPaid(c.var.db, tenantId, {
    razorpayOrderId: order.entity.id,
    paymentId: payment.entity.id,
    amount: payment.entity.amount,
    eventId: c.req.header("x-razorpay-event-id") ?? undefined,
  });
  if (result === "mismatch") console.error(`webhook amount mismatch for ${order.entity.id}`);
  return c.json({ result });
});
