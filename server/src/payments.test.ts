// Phase 4 integration tests: Razorpay order + Route split, checkout verify, webhook, invoices, sales.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { hmacSha256 } from "./hmac";
import { financialYear } from "./money";
import { razorpay } from "./payments";
import { ADMIN, call, clearContent, env, fund, login, owner, seedContent } from "./test-helpers";

const run = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
const phoneOf = (n: number) => `+9192${run}${String(n).padStart(2, "0")}`;
const host = `pay-${run}.localhost`;
const bareHost = `nopay-${run}.localhost`;
const PLACE = 920_000_000 + Number(run);
let tenant = "";
let bare = "";
let ownerCookie = "";

// Fake Razorpay: records each order request, returns a fresh order id.
const created: Record<string, unknown>[] = [];
const realCreate = razorpay.createOrder;

beforeAll(async () => {
  razorpay.createOrder = async (_env, body) => {
    created.push(body);
    return { id: `order_${run}_${created.length}` };
  };
  await seedContent("en");
  for (const [slug, phone] of [
    [`pay-${run}`, phoneOf(1)],
    [`nopay-${run}`, phoneOf(2)],
  ] as const)
    await call(
      "localhost",
      "POST",
      "/admin/tenants",
      { slug, name: `T ${slug}`, ownerPhone: phone },
      undefined,
      ADMIN,
    );
  await Promise.all([fund(`pay-${run}`), fund(`nopay-${run}`)]);
  [{ id: tenant }, { id: bare }] =
    await owner`select id from tenants where slug in (${`pay-${run}`}, ${`nopay-${run}`}) order by slug desc`;
  await owner`insert into places (id, name, admin1, country, lat, lon, tz, population)
    values (${PLACE}, ${`Paypur${run}`}, 'Gujarat', 'IN', 22.75, 72.68, 'Asia/Kolkata', 20000)`;

  ownerCookie = await login(host, tenant, phoneOf(1));
  const set = await call(
    host,
    "PATCH",
    "/tenant",
    {
      kundliPricePaise: 49900,
      gstin: "24aaacr5055k1z5",
      legalName: "Pay Astro LLP",
      address: "Kheda, Gujarat",
    },
    ownerCookie,
  );
  expect(set.status).toBe(200);
  const admin = await call(
    "localhost",
    "PATCH",
    `/admin/tenants/pay-${run}`,
    { razorpayAccountId: "acc_TEST123", commissionBps: 1000 },
    undefined,
    ADMIN,
  );
  expect(admin.json).toMatchObject({ razorpayAccountId: "acc_TEST123", commissionBps: 1000 });
  const bareOwner = await login(bareHost, bare, phoneOf(2));
  await call(bareHost, "PATCH", "/tenant", { kundliPricePaise: 29900 }, bareOwner);
});

afterAll(async () => {
  razorpay.createOrder = realCreate;
  await owner`delete from profiles where place_id = ${PLACE}`;
  await owner`delete from places where id = ${PLACE}`;
  await clearContent();
});

async function lockedReport(h: string, cookie: string) {
  const p = await call(
    h,
    "POST",
    "/profiles",
    { name: "Buyer", gender: "male", date: "1991-08-29", time: "21:00", placeId: PLACE },
    cookie,
  );
  const r = await call(h, "POST", "/reports", { profileId: p.json.id, lang: "en" }, cookie);
  expect(r.json.status).toBe("locked");
  return r.json.id as string;
}

const checkoutSig = (orderId: string, paymentId: string) =>
  hmacSha256(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`, "hex");

async function webhook(
  orderId: string,
  paymentId: string,
  amount: number,
  eventId: string,
  tenantId = tenant,
) {
  const body = {
    event: "order.paid",
    payload: {
      order: { entity: { id: orderId, notes: { tenant_id: tenantId } } },
      payment: { entity: { id: paymentId, amount } },
    },
  };
  const sig = await hmacSha256(env.RAZORPAY_WEBHOOK_SECRET, JSON.stringify(body), "hex");
  return call("localhost", "POST", "/razorpay/webhook", body, undefined, {
    "x-razorpay-signature": sig,
    "x-razorpay-event-id": eventId,
  });
}

describe("ordering", () => {
  test("tenant without a Razorpay account can't take payments", async () => {
    const cust = await login(bareHost, bare, phoneOf(30));
    const id = await lockedReport(bareHost, cust);
    expect((await call(bareHost, "POST", `/reports/${id}/order`, {}, cust)).status).toBe(409);
  });

  test("order routes the tenant's share; a second click reuses the same order", async () => {
    const cust = await login(host, tenant, phoneOf(10));
    const id = await lockedReport(host, cust);
    const before = created.length;
    const a = await call(host, "POST", `/reports/${id}/order`, {}, cust);
    const b = await call(host, "POST", `/reports/${id}/order`, {}, cust);
    expect(a.status).toBe(200);
    expect(a.json).toMatchObject({ keyId: "rzp_test_key", amount: 49900, currency: "INR" });
    expect(b.json.razorpayOrderId).toBe(a.json.razorpayOrderId);
    expect(created.length).toBe(before + 1);
    expect(created.at(-1)).toMatchObject({
      amount: 49900,
      currency: "INR",
      transfers: [{ account: "acc_TEST123", amount: 44910, currency: "INR", on_hold: false }],
      notes: { tenant_id: tenant, report_id: id },
    });
  });

  test("Razorpay failure is a clean 502, and no order is recorded", async () => {
    const cust = await login(host, tenant, phoneOf(13));
    const id = await lockedReport(host, cust);
    const fake = razorpay.createOrder;
    razorpay.createOrder = async () => {
      throw new Error("razorpay order 401: bad key");
    };
    try {
      const r = await call(host, "POST", `/reports/${id}/order`, {}, cust);
      expect(r.status).toBe(502);
      const rows = await owner`select 1 from orders where report_id = ${id}`;
      expect(rows).toHaveLength(0);
    } finally {
      razorpay.createOrder = fake;
    }
  });

  test("other customers can't open an order for someone else's report", async () => {
    const cust = await login(host, tenant, phoneOf(11));
    const id = await lockedReport(host, cust);
    const stranger = await login(host, tenant, phoneOf(12));
    expect((await call(host, "POST", `/reports/${id}/order`, {}, stranger)).status).toBe(404);
  });

  test("₹0 price makes reports free", async () => {
    const bareOwner = await login(bareHost, bare, phoneOf(2));
    await call(bareHost, "PATCH", "/tenant", { kundliPricePaise: 0 }, bareOwner);
    const cust = await login(bareHost, bare, phoneOf(31));
    const p = await call(
      bareHost,
      "POST",
      "/profiles",
      { name: "x", gender: "male", date: "1990-01-01", time: null, placeId: PLACE },
      cust,
    );
    const r = await call(bareHost, "POST", "/reports", { profileId: p.json.id, lang: "en" }, cust);
    expect(r.json.status).toBe("ready");
    await call(bareHost, "PATCH", "/tenant", { kundliPricePaise: 29900 }, bareOwner);
  });
});

describe("getting paid", () => {
  test("checkout callback unlocks at once; webhook replay is a no-op", async () => {
    const cust = await login(host, tenant, phoneOf(20));
    const id = await lockedReport(host, cust);
    const { json: o } = await call(host, "POST", `/reports/${id}/order`, {}, cust);

    const bad = await call(
      host,
      "POST",
      "/orders/verify",
      {
        razorpay_order_id: o.razorpayOrderId,
        razorpay_payment_id: `pay_${run}_A`,
        razorpay_signature: "00",
      },
      cust,
    );
    expect(bad.status).toBe(400);

    const ok = await call(
      host,
      "POST",
      "/orders/verify",
      {
        razorpay_order_id: o.razorpayOrderId,
        razorpay_payment_id: `pay_${run}_A`,
        razorpay_signature: await checkoutSig(o.razorpayOrderId, `pay_${run}_A`),
      },
      cust,
    );
    expect(ok.json).toMatchObject({ status: "paid", reportId: id });
    expect((await call(host, "GET", `/reports/${id}`, undefined, cust)).status).toBe(200);

    expect((await webhook(o.razorpayOrderId, `pay_${run}_A`, 49900, `evt_${run}_1`)).json).toEqual({
      result: "already",
    });
    expect((await call(host, "POST", `/reports/${id}/order`, {}, cust)).status).toBe(409); // already unlocked
  });

  test("webhook alone unlocks; replay and bad signatures do nothing", async () => {
    const cust = await login(host, tenant, phoneOf(21));
    const id = await lockedReport(host, cust);
    const { json: o } = await call(host, "POST", `/reports/${id}/order`, {}, cust);

    const forged = await call(
      "localhost",
      "POST",
      "/razorpay/webhook",
      { event: "order.paid" },
      undefined,
      { "x-razorpay-signature": "abc" },
    );
    expect(forged.status).toBe(400);

    expect((await webhook(o.razorpayOrderId, `pay_${run}_B`, 49900, `evt_${run}_2`)).json).toEqual({
      result: "paid",
    });
    expect((await webhook(o.razorpayOrderId, `pay_${run}_B`, 49900, `evt_${run}_2`)).json).toEqual({
      result: "already",
    });
    expect((await call(host, "GET", `/reports/${id}`, undefined, cust)).status).toBe(200);
  });

  test("wrong amount or another tenant's id never unlocks", async () => {
    const cust = await login(host, tenant, phoneOf(22));
    const id = await lockedReport(host, cust);
    const { json: o } = await call(host, "POST", `/reports/${id}/order`, {}, cust);
    expect((await webhook(o.razorpayOrderId, `pay_${run}_C`, 100, `evt_${run}_3`)).json).toEqual({
      result: "mismatch",
    });
    expect(
      (await webhook(o.razorpayOrderId, `pay_${run}_C`, 49900, `evt_${run}_4`, bare)).json,
    ).toEqual({ result: "unknown" });
    expect((await call(host, "GET", `/reports/${id}`, undefined, cust)).status).toBe(402);
  });
});

describe("invoices and sales", () => {
  test("invoice numbers run consecutively per tenant and FY; GST split on the invoice", async () => {
    const fy = financialYear(new Date());
    const { json: list } = await call(host, "GET", "/tenant/orders", undefined, ownerCookie);
    const nos = list
      .filter((o: { status: string }) => o.status === "paid")
      .map((o: { invoiceNo: string }) => o.invoiceNo)
      .sort();
    expect(nos).toEqual([`${fy}/00001`, `${fy}/00002`]);

    const cust = await login(host, tenant, phoneOf(20));
    const { json: mine } = await call(host, "GET", "/orders", undefined, cust);
    const paid = mine.find((o: { status: string }) => o.status === "paid");
    const inv = await call(host, "GET", `/orders/${paid.id}`, undefined, cust);
    expect(inv.json).toMatchObject({
      kind: "tax-invoice",
      seller: { name: "Pay Astro LLP", gstin: "24AAACR5055K1Z5" },
      amountPaise: 49900,
      taxablePaise: 42288,
      cgst: 3806,
      sgst: 3806,
    });
    const stranger = await login(host, tenant, phoneOf(12));
    expect((await call(host, "GET", `/orders/${paid.id}`, undefined, stranger)).status).toBe(404);
    expect((await call(host, "GET", `/orders/${paid.id}`, undefined, ownerCookie)).status).toBe(
      200,
    );
  });

  test("owner sees revenue, CSV and customers; astrologers don't", async () => {
    const rev = await call(host, "GET", "/tenant/revenue", undefined, ownerCookie);
    expect(rev.json[0]).toMatchObject({
      orders: 2,
      grossPaise: 99800,
      commissionPaise: 9980,
      yourSharePaise: 89820,
    });

    const csv = await call(host, "GET", "/tenant/orders.csv", undefined, ownerCookie);
    const text = await csv.res.text();
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    expect(text.split("\n")[0]).toStartWith("created_at,paid_at,status,kind,invoice_no");
    expect(text).toContain("499.00,76.12,49.90,449.10");

    const customers = await call(host, "GET", "/tenant/customers", undefined, ownerCookie);
    expect(customers.json.find((u: { phone: string }) => u.phone === phoneOf(20))).toMatchObject({
      paidOrders: 1,
      spentPaise: 49900,
    });

    const astroPhone = phoneOf(40);
    await call(
      host,
      "POST",
      "/tenant/staff",
      { phone: astroPhone, role: "astrologer" },
      ownerCookie,
    );
    const astro = await login(host, tenant, astroPhone);
    for (const path of [
      "/tenant/orders",
      "/tenant/orders.csv",
      "/tenant/revenue",
      "/tenant/customers",
    ])
      expect((await call(host, "GET", path, undefined, astro)).status).toBe(403);
  });

  test("owner can't change commission or the payout account; bad GSTIN rejected", async () => {
    expect((await call(host, "PATCH", "/tenant", { commissionBps: 0 }, ownerCookie)).status).toBe(
      400,
    );
    expect(
      (await call(host, "PATCH", "/tenant", { razorpayAccountId: "acc_X" }, ownerCookie)).status,
    ).toBe(400);
    expect((await call(host, "PATCH", "/tenant", { gstin: "123" }, ownerCookie)).status).toBe(400);
    expect(
      (await call(host, "GET", "/tenant/settings", undefined, ownerCookie)).json,
    ).toMatchObject({ paymentsReady: true, commissionBps: 1000 });
  });
});

describe("local test payments", () => {
  const devFake = { ...env, DEV_FAKE_PAYMENTS: "1" };
  const prodFake = { ...env, DEV_FAKE_PAYMENTS: "1", ENVIRONMENT: "production" as const };

  test("with the switch on, Pay works without Razorpay and unlocks the report", async () => {
    const cust = await login(bareHost, bare, phoneOf(50));
    const id = await lockedReport(bareHost, cust);
    const o = await call(bareHost, "POST", `/reports/${id}/order`, {}, cust, {}, devFake);
    expect(o.json).toMatchObject({ fake: true, amount: 29900 });

    const stranger = await login(bareHost, bare, phoneOf(51));
    const theirs = await call(
      bareHost,
      "POST",
      "/orders/fake-pay",
      { razorpayOrderId: o.json.razorpayOrderId },
      stranger,
      {},
      devFake,
    );
    expect(theirs.status).toBe(404);

    const paid = await call(
      bareHost,
      "POST",
      "/orders/fake-pay",
      { razorpayOrderId: o.json.razorpayOrderId },
      cust,
      {},
      devFake,
    );
    expect(paid.json).toMatchObject({ status: "paid", reportId: id });
    expect((await call(bareHost, "GET", `/reports/${id}`, undefined, cust)).status).toBe(200);
  });

  test("off by default, and never in production", async () => {
    const cust = await login(bareHost, bare, phoneOf(52));
    const id = await lockedReport(bareHost, cust);
    for (const b of [env, prodFake]) {
      expect((await call(bareHost, "POST", `/reports/${id}/order`, {}, cust, {}, b)).status).toBe(
        409,
      );
      const r = await call(
        bareHost,
        "POST",
        "/orders/fake-pay",
        { razorpayOrderId: "fake_order_x" },
        cust,
        {},
        b,
      );
      expect(r.status).toBe(404);
    }
    expect((await call(bareHost, "GET", `/reports/${id}`, undefined, cust)).status).toBe(402);
  });
});

describe("printed copy", () => {
  const ship = {
    name: "Chiragbhai Rohit",
    phone: "+919811112222",
    address: "12 Station Road, Aagarva",
    city: "Kheda",
    state: "Gujarat",
    pincode: "387411",
  };

  test("needs a valid address; charged at the print price; tenant sees it to post and marks it shipped", async () => {
    const cust = await login(host, tenant, phoneOf(60));
    const id = await lockedReport(host, cust);
    expect((await call(host, "POST", `/reports/${id}/order`, { kind: "print" }, cust)).status).toBe(
      400,
    );
    const badPin = await call(
      host,
      "POST",
      `/reports/${id}/order`,
      { kind: "print", ship: { ...ship, pincode: "12" } },
      cust,
    );
    expect(badPin.status).toBe(400);

    const before = created.length;
    const o = await call(host, "POST", `/reports/${id}/order`, { kind: "print", ship }, cust);
    expect(o.json.amount).toBe(50000); // default print price
    expect(created.at(-1)).toMatchObject({ amount: 50000, notes: { kind: "print" } });
    expect(created.length).toBe(before + 1);

    expect(
      (await webhook(o.json.razorpayOrderId, `pay_${run}_P`, 50000, `evt_${run}_P`)).json,
    ).toEqual({ result: "paid" });
    expect((await call(host, "GET", `/reports/${id}`, undefined, cust)).status).toBe(200); // PDF included

    const list = await call(host, "GET", "/tenant/fulfilment", undefined, ownerCookie);
    const row = list.json.find((r: { id: string }) => r.id === o.json.orderId);
    expect(row).toMatchObject({ shipName: ship.name, shipPincode: "387411", shippedAt: null });

    const shipped = await call(
      host,
      "POST",
      `/tenant/orders/${o.json.orderId}/shipped`,
      { trackingNo: "EE123456789IN" },
      ownerCookie,
    );
    expect(shipped.json.trackingNo).toBe("EE123456789IN");
    const mine = await call(host, "GET", "/orders", undefined, cust);
    expect(mine.json.find((x: { id: string }) => x.id === o.json.orderId)).toMatchObject({
      kind: "print",
      trackingNo: "EE123456789IN",
    });
    const inv = await call(host, "GET", `/orders/${o.json.orderId}`, undefined, cust);
    expect(inv.json.item.kind).toBe("print");
  });

  test("print can be bought after the PDF; only the owner sees the posting list", async () => {
    const cust = await login(host, tenant, phoneOf(61));
    const id = await lockedReport(host, cust);
    const pdf = await call(host, "POST", `/reports/${id}/order`, {}, cust);
    await webhook(pdf.json.razorpayOrderId, `pay_${run}_Q`, 49900, `evt_${run}_Q`);
    expect((await call(host, "POST", `/reports/${id}/order`, {}, cust)).status).toBe(409); // PDF already owned
    expect(
      (await call(host, "POST", `/reports/${id}/order`, { kind: "print", ship }, cust)).status,
    ).toBe(200);
    expect((await call(host, "GET", "/tenant/fulfilment", undefined, cust)).status).toBe(403);
  });

  test("deleting the account clears delivery addresses but keeps the order", async () => {
    const cust = await login(host, tenant, phoneOf(62));
    const id = await lockedReport(host, cust);
    const o = await call(host, "POST", `/reports/${id}/order`, { kind: "print", ship }, cust);
    expect((await call(host, "DELETE", "/me", undefined, cust)).status).toBe(204);
    const [row] =
      await owner`select ship_name, ship_address, amount_paise from orders where id = ${o.json.orderId}`;
    expect(row).toEqual({ ship_name: null, ship_address: null, amount_paise: 50000 });
  });
});

describe("offline payments (cash, card, UPI at the counter)", () => {
  test("staff record a cash sale: paid order with the next invoice number, kundli unlocks, no commission", async () => {
    const cust = await login(host, tenant, phoneOf(60));
    const reportId = await lockedReport(host, cust);
    const astro = await login(host, tenant, phoneOf(61));
    await call(
      host,
      "POST",
      "/tenant/staff",
      { phone: phoneOf(61), role: "astrologer" },
      ownerCookie,
    );
    const astroCookie = await login(host, tenant, phoneOf(61));

    // Customers can't mark their own kundli paid.
    const self = await call(
      host,
      "POST",
      `/reports/${reportId}/offline-payment`,
      { kind: "pdf", amountPaise: 49900, method: "cash" },
      cust,
    );
    expect(self.status).toBe(403);
    expect(astro).toBeTruthy();

    const r = await call(
      host,
      "POST",
      `/reports/${reportId}/offline-payment`,
      { kind: "pdf", amountPaise: 49900, method: "cash" },
      astroCookie,
    );
    expect(r.status).toBe(201);
    expect(r.json.invoiceNo).toMatch(new RegExp(`^${financialYear(new Date())}/\\d{5}$`));
    expect((await call(host, "GET", `/reports/${reportId}`, undefined, cust)).status).toBe(200);

    const again = await call(
      host,
      "POST",
      `/reports/${reportId}/offline-payment`,
      { kind: "pdf", amountPaise: 49900, method: "upi" },
      astroCookie,
    );
    expect(again.status).toBe(409); // the PDF can only be sold once

    const [o] = await owner`select * from orders where id = ${r.json.orderId}`;
    expect(o).toMatchObject({
      status: "paid",
      payment_method: "cash",
      commission_paise: 0,
      gst_paise: 7612,
      user_id: expect.any(String),
    });

    // The invoice says Cash, the customer sees it in their orders.
    const inv = await call(host, "GET", `/orders/${r.json.orderId}`, undefined, cust);
    expect(inv.json.payment).toEqual({ method: "cash", ref: null });
  });

  test("UPI with a reference; a printed copy is handed over (not in the posting list); bad references refused", async () => {
    const cust = await login(host, tenant, phoneOf(62));
    const reportId = await lockedReport(host, cust);
    const bad = await call(
      host,
      "POST",
      `/reports/${reportId}/offline-payment`,
      { kind: "print", amountPaise: 69900, method: "upi", reference: "=HYPERLINK(1)" },
      ownerCookie,
    );
    expect(bad.status).toBe(400);

    const r = await call(
      host,
      "POST",
      `/reports/${reportId}/offline-payment`,
      { kind: "print", amountPaise: 69900, method: "upi", reference: "UPI 4021 7788" },
      ownerCookie,
    );
    expect(r.status).toBe(201);
    const inv = await call(host, "GET", `/orders/${r.json.orderId}`, undefined, ownerCookie);
    expect(inv.json.payment).toEqual({ method: "upi", ref: "UPI 4021 7788" });

    const posting = await call(host, "GET", "/tenant/fulfilment", undefined, ownerCookie);
    expect(
      posting.json.find((x: { id: string }) => x.id === r.json.orderId).shippedAt,
    ).toBeTruthy();

    const list = await call(host, "GET", "/tenant/orders", undefined, ownerCookie);
    expect(list.json.find((x: { id: string }) => x.id === r.json.orderId)).toMatchObject({
      paymentMethod: "upi",
      paymentRef: "UPI 4021 7788",
      name: "Buyer",
    });
    const csv = await call(host, "GET", "/tenant/orders.csv", undefined, ownerCookie);
    expect(await csv.res.text()).toContain("upi,UPI 4021 7788");
  });
});
