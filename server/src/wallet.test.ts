// Tenant wallet: ₹10 platform fee per kundli, no kundlis without balance. Needs Postgres + Redis.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { hmacSha256 } from "./hmac";
import { razorpay } from "./payments";
import { ADMIN, call, clearContent, env, fund, login, owner, seedContent } from "./test-helpers";

const run = Math.floor(Math.random() * 1e6)
  .toString()
  .padStart(6, "0");
const phoneOf = (n: number) => `+9193${run}${String(n).padStart(2, "0")}`;
const slug = `wl-${run}`;
const host = `${slug}.localhost`;
const PLACE = 930_000_000 + Number(run);
let tenant = "";

const balance = async () =>
  (await owner`select wallet_paise from tenants where id = ${tenant}`)[0]!.wallet_paise as number;
const newKundli = async (cookie: string) => {
  const p = await call(
    host,
    "POST",
    "/profiles",
    { name: "Asha", gender: "female", date: "1990-01-01", time: "10:00", placeId: PLACE },
    cookie,
  );
  return call(host, "POST", "/reports", { profileId: p.json.id, lang: "en" }, cookie);
};

beforeAll(async () => {
  await seedContent("en");
  const t = await call(
    "localhost",
    "POST",
    "/admin/tenants",
    { slug, name: "Wallet Test", ownerPhone: phoneOf(1), kundliPricePaise: 9900 },
    undefined,
    ADMIN,
  );
  tenant = t.json.id;
  await owner`insert into places (id, name, admin1, country, lat, lon, tz, population)
    values (${PLACE}, ${`Walletpur${run}`}, 'Gujarat', 'IN', 22.3, 70.8, 'Asia/Kolkata', 20000)`;
});

afterAll(async () => {
  await owner`delete from profiles where place_id = ${PLACE}`;
  await owner`delete from places where id = ${PLACE}`;
  await clearContent();
});

describe("wallet", () => {
  test("empty wallet: nobody can create a kundli; customers aren't told about the wallet", async () => {
    const cust = await newKundli(await login(host, tenant, phoneOf(10)));
    const own = await newKundli(await login(host, tenant, phoneOf(1)));
    expect([cust.status, own.status]).toEqual([402, 402]);
    expect(cust.json.code).toBe("wallet_empty");
    expect(cust.json.error).toContain("contact Wallet Test");
    expect(own.json.error).toContain("recharge");
  });

  test("owner's own kundli costs only the ₹10 fee; stops when the balance can't cover it", async () => {
    await fund(slug, 1500);
    const cookie = await login(host, tenant, phoneOf(1));
    const r = await newKundli(cookie);
    expect(r.status).toBe(201);
    expect(r.json.status).toBe("ready"); // no sale price for staff
    expect(await balance()).toBe(500);
    expect((await newKundli(cookie)).status).toBe(402);
    expect(await balance()).toBe(500); // the refused kundli wasn't stored or charged

    const w = await call(host, "GET", "/tenant/wallet", undefined, cookie);
    expect(w.json.balancePaise).toBe(500);
    expect(w.json.reportFeePaise).toBe(1000);
    expect(w.json.transactions.map((x: { kind: string }) => x.kind)).toEqual([
      "report_fee",
      "topup",
    ]);
  });

  test("a customer clicking again reuses the unpaid kundli: charged once", async () => {
    await fund(slug, 500); // balance 1000: exactly one fee
    const cust = await login(host, tenant, phoneOf(11));
    const p = await call(
      host,
      "POST",
      "/profiles",
      { name: "Ravi", gender: "male", date: "1985-05-05", time: "06:30", placeId: PLACE },
      cust,
    );
    const first = await call(host, "POST", "/reports", { profileId: p.json.id, lang: "en" }, cust);
    const again = await call(host, "POST", "/reports", { profileId: p.json.id, lang: "en" }, cust);
    expect([first.status, again.status]).toEqual([201, 200]);
    expect(again.json.id).toBe(first.json.id);
    expect(await balance()).toBe(0);
  });

  test("admin sees balance and fees; adjustments can be negative; customers can't see the wallet", async () => {
    const adj = await call(
      "localhost",
      "POST",
      `/admin/tenants/${slug}/credit`,
      { amountPaise: -200, note: "correction" },
      undefined,
      ADMIN,
    );
    expect(adj.json.balancePaise).toBe(-200);
    const list = await call("localhost", "GET", "/admin/tenants", undefined, undefined, ADMIN);
    expect(list.json.find((t: { slug: string }) => t.slug === slug)).toMatchObject({
      walletPaise: -200,
      feesPaise: 2000,
    });
    const cust = await login(host, tenant, phoneOf(10));
    expect((await call(host, "GET", "/tenant/wallet", undefined, cust)).status).toBe(403);
  });

  test("the platform admin sets the fee; a tenant override wins; null goes back to the platform fee", async () => {
    const admin = (method: string, path: string, body: unknown) =>
      call("localhost", method, path, body, undefined, ADMIN);
    const before = (await call("localhost", "GET", "/admin/settings", undefined, undefined, ADMIN))
      .json.reportFeePaise;
    const cookie = await login(host, tenant, phoneOf(1));
    try {
      await owner`update tenants set wallet_paise = 10000 where id = ${tenant}`;
      await admin("PATCH", "/admin/settings", { reportFeePaise: 2500 });
      expect(
        (await call(host, "GET", "/tenant/wallet", undefined, cookie)).json.reportFeePaise,
      ).toBe(2500);
      expect((await newKundli(cookie)).status).toBe(201);
      expect(await balance()).toBe(7500);

      await admin("PATCH", `/admin/tenants/${slug}`, { reportFeePaise: 500 });
      expect((await newKundli(cookie)).status).toBe(201);
      expect(await balance()).toBe(7000);

      await admin("PATCH", `/admin/tenants/${slug}`, { reportFeePaise: null });
      const list = await call("localhost", "GET", "/admin/tenants", undefined, undefined, ADMIN);
      expect(list.json.find((t: { slug: string }) => t.slug === slug)).toMatchObject({
        reportFeePaise: null,
        effectiveFeePaise: 2500,
      });
    } finally {
      await admin("PATCH", "/admin/settings", { reportFeePaise: before });
    }
  });
});

describe("online recharge", () => {
  const realCreate = razorpay.createOrder;
  let n = 0;
  const orderFor = () => `order_wl${run}${n++}`;

  test("owner pays online: credited once via checkout callback, webhook replay is a no-op", async () => {
    const cookie = await login(host, tenant, phoneOf(1));
    const start = await balance();
    let sentBody: Record<string, unknown> = {};
    const id = orderFor();
    razorpay.createOrder = async (_e, body) => {
      sentBody = body;
      return { id };
    };
    try {
      const small = await call(host, "POST", "/tenant/wallet/topup", { amountPaise: 5000 }, cookie);
      expect(small.status).toBe(400); // under ₹100
      const o = await call(host, "POST", "/tenant/wallet/topup", { amountPaise: 50000 }, cookie);
      expect(o.json).toMatchObject({ razorpayOrderId: id, amount: 50000, fake: false });
      expect(sentBody).not.toHaveProperty("transfers"); // platform's money, not the tenant's
    } finally {
      razorpay.createOrder = realCreate;
    }

    const pay = `pay_wl${run}`;
    const sig = await hmacSha256(env.RAZORPAY_KEY_SECRET, `${id}|${pay}`, "hex");
    const bad = await call(
      host,
      "POST",
      "/tenant/wallet/topup/verify",
      { razorpay_order_id: id, razorpay_payment_id: pay, razorpay_signature: "x" },
      cookie,
    );
    expect(bad.status).toBe(400);
    const ok = await call(
      host,
      "POST",
      "/tenant/wallet/topup/verify",
      { razorpay_order_id: id, razorpay_payment_id: pay, razorpay_signature: sig },
      cookie,
    );
    expect(ok.status).toBe(200);
    expect(await balance()).toBe(start + 50000);

    const body = {
      event: "order.paid",
      payload: {
        order: { entity: { id, notes: { tenant_id: tenant, purpose: "wallet" } } },
        payment: { entity: { id: pay, amount: 50000 } },
      },
    };
    const whSig = await hmacSha256(env.RAZORPAY_WEBHOOK_SECRET, JSON.stringify(body), "hex");
    const wh = await call("localhost", "POST", "/razorpay/webhook", body, undefined, {
      "x-razorpay-signature": whSig,
    });
    expect(wh.json.result).toBe("already");
    expect(await balance()).toBe(start + 50000);
    const w = await call(host, "GET", "/tenant/wallet", undefined, cookie);
    expect(w.json.transactions[0]).toMatchObject({
      kind: "topup",
      amountPaise: 50000,
      note: "Paid online",
    });
  });

  test("webhook alone credits; wrong amount never does; customers can't recharge", async () => {
    const cookie = await login(host, tenant, phoneOf(1));
    const id = orderFor();
    razorpay.createOrder = async () => ({ id });
    try {
      await call(host, "POST", "/tenant/wallet/topup", { amountPaise: 20000 }, cookie);
    } finally {
      razorpay.createOrder = realCreate;
    }
    const start = await balance();
    const hook = async (amount: number) => {
      const body = {
        event: "order.paid",
        payload: {
          order: { entity: { id, notes: { tenant_id: tenant, purpose: "wallet" } } },
          payment: { entity: { id: `pay_${id}`, amount } },
        },
      };
      const sig = await hmacSha256(env.RAZORPAY_WEBHOOK_SECRET, JSON.stringify(body), "hex");
      return call("localhost", "POST", "/razorpay/webhook", body, undefined, {
        "x-razorpay-signature": sig,
      });
    };
    expect((await hook(100)).json.result).toBe("mismatch");
    expect(await balance()).toBe(start);
    expect((await hook(20000)).json.result).toBe("paid");
    expect(await balance()).toBe(start + 20000);

    const cust = await login(host, tenant, phoneOf(12));
    expect(
      (await call(host, "POST", "/tenant/wallet/topup", { amountPaise: 20000 }, cust)).status,
    ).toBe(403);
  });
});
