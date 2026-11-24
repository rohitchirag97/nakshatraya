// Pure money rules for Phase 4. All amounts in paise (integers).

/**
 * Prices include GST. Commission comes off the full amount; the tenant's Route transfer gets the rest.
 * With a GSTIN the amount splits into taxable value + 18% GST; without one there is no tax line.
 */
export function splitAmount(amountPaise: number, commissionBps: number, gstRegistered: boolean) {
  const commission = Math.round((amountPaise * commissionBps) / 10_000);
  const taxable = gstRegistered ? Math.round((amountPaise * 100) / 118) : amountPaise;
  return { commission, tenantShare: amountPaise - commission, taxable, gst: amountPaise - taxable };
}

/**
 * B2C sale with no buyer address on record: place of supply is the supplier's state (IGST Act s.12(2)),
 * so it's always intra-state CGST + SGST, half each.
 */
export const cgstSgst = (gst: number) => ({
  cgst: Math.floor(gst / 2),
  sgst: gst - Math.floor(gst / 2),
});

/** Indian financial year (Apr–Mar, in IST) as "2627" for Apr 2026 to Mar 2027. */
export function financialYear(at: Date) {
  const ist = new Date(at.getTime() + 5.5 * 3600_000);
  const start = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${String(start % 100).padStart(2, "0")}${String((start + 1) % 100).padStart(2, "0")}`;
}

/** GST invoice numbers: unique per tenant and FY, consecutive, at most 16 characters. */
export const invoiceNumber = (fy: string, n: number) => `${fy}/${String(n).padStart(5, "0")}`;

export const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
