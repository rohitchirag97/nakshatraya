import { expect, test } from "bun:test";
import { cgstSgst, financialYear, GSTIN, invoiceNumber, splitAmount } from "./money";

test("split: commission + tenant share and taxable + gst always add up to the amount", () => {
  for (const amount of [100, 49900, 51100, 99999, 100000]) {
    for (const bps of [0, 1000, 1500, 10000]) {
      for (const reg of [true, false]) {
        const s = splitAmount(amount, bps, reg);
        expect(s.commission + s.tenantShare).toBe(amount);
        expect(s.taxable + s.gst).toBe(amount);
        if (!reg) expect(s.gst).toBe(0);
      }
    }
  }
});

test("₹499 incl. GST at 10% commission", () => {
  expect(splitAmount(49900, 1000, true)).toEqual({
    commission: 4990,
    tenantShare: 44910,
    taxable: 42288, // 49900 / 1.18
    gst: 7612,
  });
  expect(cgstSgst(7612)).toEqual({ cgst: 3806, sgst: 3806 });
  expect(cgstSgst(7613)).toEqual({ cgst: 3806, sgst: 3807 });
});

test("financial year turns over on 1 April IST", () => {
  expect(financialYear(new Date("2026-03-31T18:29:59Z"))).toBe("2526"); // 31 Mar 23:59 IST
  expect(financialYear(new Date("2026-03-31T18:30:00Z"))).toBe("2627"); // 1 Apr 00:00 IST
  expect(financialYear(new Date("2099-12-01Z"))).toBe("9900");
  expect(invoiceNumber("2627", 42)).toBe("2627/00042");
  expect(invoiceNumber("2627", 42).length).toBeLessThanOrEqual(16);
});

test("GSTIN format", () => {
  expect(GSTIN.test("24AAACR5055K1Z5")).toBe(true);
  expect(GSTIN.test("24aaacr5055k1z5")).toBe(false);
  expect(GSTIN.test("24AAACR5055K1Y5")).toBe(false);
});
