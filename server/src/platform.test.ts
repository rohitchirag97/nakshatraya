// Platform admin panel API and the public apply form. Needs Postgres + Redis; see README.
import { afterAll, describe, expect, test } from "bun:test";
import { app } from "./index";
import { ADMIN, call, env, owner } from "./test-helpers";

const run = Math.floor(Math.random() * 1e6)
  .toString()
  .padStart(6, "0");
const ip = { "cf-connecting-ip": `10.9.${run.slice(0, 3)}.${Number(run.slice(3)) % 250}` };
const phone = `+9191${run}01`;
const slug = `ap-${run}`;

afterAll(async () => {
  await owner`delete from tenant_applications where phone like ${`+9191${run}%`}`;
});

const apply = (body: Record<string, unknown>) =>
  call("localhost", "POST", "/apply", body, undefined, ip);

describe("apply", () => {
  test("stores an application with the chosen offer", async () => {
    const r = await apply({
      businessName: "Shree Jyotish",
      contactName: "Ramesh",
      phone,
      city: "Anand",
      preferredSlug: slug,
      wantsShop: true,
      wantsConsult: false,
      pdfPricePaise: 14900,
      printPricePaise: 69900,
    });
    expect(r.status).toBe(201);
    const [a] = await owner`select * from tenant_applications where phone = ${phone}`;
    expect(a).toMatchObject({
      status: "pending",
      wants_shop: true,
      wants_consult: false,
      pdf_price_paise: 14900,
    });
  });

  test("one pending application per phone; bad input rejected", async () => {
    const dup = await apply({ businessName: "X Y", contactName: "Ab", phone, city: "Anand" });
    const bad = await apply({ businessName: "X", contactName: "Ab", phone: "123", city: "A" });
    expect([dup.status, bad.status]).toEqual([409, 400]);
  });
});

describe("admin panel", () => {
  test("OTP login only for platform admins; removing the admin ends the session", async () => {
    const adminPhone = `+9192${run}01`;
    await owner`insert into platform_admins (phone) values (${adminPhone})`;
    expect((await call("localhost", "GET", "/admin/me")).status).toBe(403);

    // A non-admin gets the same answer, but no code.
    const stranger = await call(
      "localhost",
      "POST",
      "/admin/otp",
      { phone: `+9192${run}02` },
      undefined,
      ip,
    );
    expect(stranger.status).toBe(200);
    expect(stranger.json.devCode).toBeUndefined();

    const sent = await call(
      "localhost",
      "POST",
      "/admin/otp",
      { phone: adminPhone },
      undefined,
      ip,
    );
    expect(sent.json.devCode).toMatch(/^\d{6}$/);
    const wrong = await call(
      "localhost",
      "POST",
      "/admin/verify",
      { phone: adminPhone, code: sent.json.devCode === "000000" ? "111111" : "000000" },
      undefined,
      ip,
    );
    expect(wrong.status).toBe(401);

    const res = await app.request(
      "/api/admin/verify",
      {
        method: "POST",
        headers: { host: "localhost", "content-type": "application/json", ...ip },
        body: JSON.stringify({ phone: adminPhone, code: sent.json.devCode }),
      },
      env,
    );
    const cookie = res.headers.get("set-cookie")?.match(/padm=[^;]+/)?.[0];
    expect(res.status).toBe(200);
    const me = await call("localhost", "GET", "/admin/me", undefined, cookie);
    expect(me.json.phone).toBe(adminPhone);

    await owner`delete from platform_admins where phone = ${adminPhone}`;
    expect((await call("localhost", "GET", "/admin/me", undefined, cookie)).status).toBe(403);
  });

  test("production never puts the code in the response", async () => {
    const adminPhone = `+9192${run}03`;
    await owner`insert into platform_admins (phone) values (${adminPhone})`;
    const prod = { ...env, ENVIRONMENT: "production" } as typeof env;
    const r = await call(
      "localhost",
      "POST",
      "/admin/otp",
      { phone: adminPhone },
      undefined,
      ip,
      prod,
    );
    // No SMS provider configured: production refuses rather than leaking or dropping the code.
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.json)).not.toMatch(/\d{6}/);
    await owner`delete from platform_admins where phone = ${adminPhone}`;
  });

  test("approve creates the tenant with the applicant's prices and features", async () => {
    const list = await call("localhost", "GET", "/admin/applications", undefined, undefined, ADMIN);
    const a = list.json.find((x: { phone: string }) => x.phone === phone);
    const ok = await call(
      "localhost",
      "POST",
      `/admin/applications/${a.id}/approve`,
      { slug },
      undefined,
      ADMIN,
    );
    expect(ok.status).toBe(201);
    const again = await call(
      "localhost",
      "POST",
      `/admin/applications/${a.id}/approve`,
      { slug: `${slug}x` },
      undefined,
      ADMIN,
    );
    expect(again.status).toBe(409);

    const t = await call(`${slug}.localhost`, "GET", "/tenant");
    expect(t.json).toMatchObject({
      name: "Shree Jyotish",
      kundliPricePaise: 14900,
      printPricePaise: 69900,
      shopEnabled: true,
      consultEnabled: false,
    });

    const tenants = await call("localhost", "GET", "/admin/tenants", undefined, undefined, ADMIN);
    expect(tenants.json.find((x: { slug: string }) => x.slug === slug)).toMatchObject({
      ownerPhone: phone,
      paidOrders: 0,
    });
  });

  test("edit features, prices and custom domain; a domain can't be shared", async () => {
    const r = await call(
      "localhost",
      "PATCH",
      `/admin/tenants/${slug}`,
      { consultEnabled: true, printPricePaise: 59900, domain: `${slug}.example.com` },
      undefined,
      ADMIN,
    );
    expect(r.json).toMatchObject({ consultEnabled: true, printPricePaise: 59900 });
    const viaDomain = await call(`${slug}.example.com`, "GET", "/tenant");
    expect(viaDomain.json.slug).toBe(slug);

    const other = await call(
      "localhost",
      "POST",
      "/admin/tenants",
      { slug: `${slug}b`, name: "B", ownerPhone: `+9191${run}02` },
      undefined,
      ADMIN,
    );
    expect(other.status).toBe(201);
    const clash = await call(
      "localhost",
      "PATCH",
      `/admin/tenants/${slug}b`,
      { domain: `${slug}.example.com` },
      undefined,
      ADMIN,
    );
    expect(clash.status).toBe(409);
  });

  test("reject only pending applications", async () => {
    const p2 = `+9191${run}03`;
    await apply({ businessName: "Reject Me", contactName: "Ab", phone: p2, city: "Surat" });
    const [a] = await owner`select id from tenant_applications where phone = ${p2}`;
    const r1 = await call(
      "localhost",
      "POST",
      `/admin/applications/${a!.id}/reject`,
      undefined,
      undefined,
      ADMIN,
    );
    const r2 = await call(
      "localhost",
      "POST",
      `/admin/applications/${a!.id}/reject`,
      undefined,
      undefined,
      ADMIN,
    );
    expect([r1.status, r2.status]).toEqual([200, 404]);
  });
});
