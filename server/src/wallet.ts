import {
  type Db,
  platformSettings,
  type Tx,
  tenants,
  walletTopups,
  walletTransactions,
} from "@jyotish/db";
import { and, eq, gte, sql } from "drizzle-orm";

// Tenant's prepaid platform wallet. Every change is a ledger row plus a balance update in the same
// transaction (the caller's withTenant tx, so RLS applies).

export class WalletEmpty extends Error {
  constructor() {
    super("wallet balance too low");
  }
}

/**
 * Charges the per-kundli platform fee for `reportId`. Throws WalletEmpty (rolling back the caller's
 * transaction, report included) if the balance can't cover it. Charging the same report twice is a
 * no-op.
 */
export async function chargeReportFee(tx: Tx, tenantId: string, reportId: string, fee: number) {
  if (fee <= 0) return;
  const [row] = await tx
    .insert(walletTransactions)
    .values({ tenantId, amountPaise: -fee, kind: "report_fee", reportId })
    .onConflictDoNothing()
    .returning({ id: walletTransactions.id });
  if (!row) return;
  // Conditional decrement: two kundlis racing for the last ₹10 can't both get it.
  const [ok] = await tx
    .update(tenants)
    .set({ walletPaise: sql`${tenants.walletPaise} - ${fee}` })
    .where(and(eq(tenants.id, tenantId), gte(tenants.walletPaise, fee)))
    .returning({ id: tenants.id });
  if (!ok) throw new WalletEmpty();
}

/** Platform admin: add credit (top-up) or correct it (adjustment, may be negative). */
export async function credit(
  tx: Tx,
  tenantId: string,
  amountPaise: number,
  kind: "topup" | "adjustment",
  note: string | null,
) {
  await tx.insert(walletTransactions).values({ tenantId, amountPaise, kind, note });
  const [t] = await tx
    .update(tenants)
    .set({ walletPaise: sql`${tenants.walletPaise} + ${amountPaise}` })
    .where(eq(tenants.id, tenantId))
    .returning({ walletPaise: tenants.walletPaise });
  return t!.walletPaise;
}

/** Fee per kundli for this tenant: its own override, else the platform-wide fee. */
export async function reportFee(db: Db, t: { reportFeePaise: number | null }) {
  if (t.reportFeePaise !== null) return t.reportFeePaise;
  const [p] = await db.db.select().from(platformSettings);
  return p?.reportFeePaise ?? 1000;
}

/**
 * Online recharge paid: credit the wallet once. Checkout callback and webhook may both call this;
 * the row lock makes the second a no-op, and a wrong amount never credits.
 */
export function markTopupPaid(
  db: Db,
  tenantId: string,
  p: { razorpayOrderId: string; paymentId: string; amount?: number },
): Promise<"paid" | "already" | "unknown" | "mismatch"> {
  return db.withTenant(tenantId, async (tx) => {
    const [t] = await tx
      .select()
      .from(walletTopups)
      .where(eq(walletTopups.razorpayOrderId, p.razorpayOrderId))
      .for("update");
    if (!t) return "unknown";
    if (t.status === "paid") return "already";
    if (p.amount !== undefined && p.amount !== t.amountPaise) return "mismatch";
    await tx
      .update(walletTopups)
      .set({ status: "paid", razorpayPaymentId: p.paymentId, paidAt: new Date() })
      .where(eq(walletTopups.id, t.id));
    await credit(tx, tenantId, t.amountPaise, "topup", "Paid online");
    return "paid";
  });
}
