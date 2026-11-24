import { zValidator } from "@hono/zod-validator";
import { walletTopups, walletTransactions } from "@jyotish/db";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Env, requireRole } from "./context";
import { hmacSha256, safeEqual } from "./hmac";
import { fakePayments, razorpay } from "./payments";
import { markTopupPaid, reportFee } from "./wallet";

// Owner's wallet: balance and history, and online recharge paid to the platform (no Route transfer,
// unlike customer orders: this money is ours).

const MIN_TOPUP = 100_00; // ₹100
const MAX_TOPUP = 1_00_000_00; // ₹1,00,000

export const walletRoutes = new Hono<Env>()
  .use(requireRole("owner"))

  .get("/", async (c) => {
    const t = c.get("tenant");
    const rows = await c.var.db.withTenant(t.id, (tx) =>
      tx
        .select({
          id: walletTransactions.id,
          amountPaise: walletTransactions.amountPaise,
          kind: walletTransactions.kind,
          note: walletTransactions.note,
          createdAt: walletTransactions.createdAt,
        })
        .from(walletTransactions)
        .orderBy(desc(walletTransactions.createdAt))
        .limit(50),
    );
    return c.json({
      balancePaise: t.walletPaise,
      reportFeePaise: await reportFee(c.var.db, t),
      minTopupPaise: MIN_TOPUP,
      transactions: rows,
    });
  })

  .post(
    "/topup",
    zValidator("json", z.object({ amountPaise: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP) })),
    async (c) => {
      const t = c.get("tenant");
      const { amountPaise } = c.req.valid("json");
      const fake = fakePayments(c.env);
      let razorpayOrderId = `fake_topup_${crypto.randomUUID()}`;
      if (!fake) {
        try {
          const rz = await razorpay.createOrder(c.env, {
            amount: amountPaise,
            currency: "INR",
            receipt: `wallet-${t.slug}`.slice(0, 40),
            // purpose routes the webhook to the wallet, not to customer orders.
            notes: { tenant_id: t.id, purpose: "wallet" },
          });
          razorpayOrderId = rz.id;
        } catch (e) {
          console.error(e);
          return c.json({ error: "payment gateway unavailable, try again" }, 502);
        }
      }
      await c.var.db.withTenant(t.id, (tx) =>
        tx.insert(walletTopups).values({ tenantId: t.id, amountPaise, razorpayOrderId }),
      );
      return c.json({
        razorpayOrderId,
        keyId: c.env.RAZORPAY_KEY_ID,
        amount: amountPaise,
        currency: "INR",
        fake,
      });
    },
  )

  // Checkout success: the signature proves payment, credit at once (the webhook is then a no-op).
  .post(
    "/topup/verify",
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
      const r = await markTopupPaid(c.var.db, c.get("tenant").id, {
        razorpayOrderId: b.razorpay_order_id,
        paymentId: b.razorpay_payment_id,
      });
      if (r === "unknown") return c.json({ error: "recharge not found" }, 404);
      return c.json({ status: "paid" });
    },
  )

  // Local test payments only: credit without Razorpay.
  .post(
    "/topup/fake-pay",
    zValidator("json", z.object({ razorpayOrderId: z.string().startsWith("fake_topup_") })),
    async (c) => {
      if (!fakePayments(c.env)) return c.json({ error: "not found" }, 404);
      const t = c.get("tenant");
      const { razorpayOrderId } = c.req.valid("json");
      const [own] = await c.var.db.withTenant(t.id, (tx) =>
        tx
          .select({ id: walletTopups.id })
          .from(walletTopups)
          .where(
            and(eq(walletTopups.razorpayOrderId, razorpayOrderId), eq(walletTopups.tenantId, t.id)),
          ),
      );
      if (!own) return c.json({ error: "recharge not found" }, 404);
      await markTopupPaid(c.var.db, t.id, {
        razorpayOrderId,
        paymentId: `fake_pay_${crypto.randomUUID()}`,
      });
      return c.json({ status: "paid" });
    },
  );
