// Phase 2 integration tests. Needs Postgres (migrated) and Redis; see README.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ADMIN, call, clearContent, fund, login, owner, redis, seedContent } from "./test-helpers";

const run = Math.floor(Math.random() * 1e6)
  .toString()
  .padStart(6, "0");
const phoneOf = (n: number) => `+9190${run}${String(n).padStart(2, "0")}`;
const slugA = `ta-${run}`;
const slugB = `tb-${run}`;
const PLACE = 900_000_000 + Number(run);
let tenantA = "";

const hostA = `${slugA}.localhost`;
const hostB = `${slugB}.localhost`;

beforeAll(async () => {
  await seedContent("en");
  await seedContent("hi");
  const admin = ADMIN;
  const a = await call(
    "localhost",
    "POST",
    "/admin/tenants",
    { slug: slugA, name: "A", ownerPhone: phoneOf(1) },
    undefined,
    admin,
  );
  const b = await call(
    "localhost",
    "POST",
    "/admin/tenants",
    { slug: slugB, name: "B", ownerPhone: phoneOf(2) },
    undefined,
    admin,
  );
  expect([a.status, b.status]).toEqual([201, 201]);
  await Promise.all([fund(slugA), fund(slugB)]);
  tenantA = a.json.id;
  await owner`insert into places (id, name, alt_names, country, lat, lon, tz, population)
    values (${PLACE}, ${`Testpur${run}`}, ${[`टेस्टपुर${run}`]}, 'IN', 28.6, 77.2, 'Asia/Kolkata', 20000)`;
});

afterAll(async () => {
  await owner`delete from profiles where place_id = ${PLACE}`;
  await owner`delete from places where id = ${PLACE}`;
  await clearContent();
});

describe("admin", () => {
  test("needs the token", async () => {
    const r = await call("localhost", "POST", "/admin/tenants", {
      slug: "zz-x",
      name: "x",
      ownerPhone: phoneOf(9),
    });
    expect(r.status).toBe(403);
  });
  test("rejects reserved and taken slugs", async () => {
    const admin = ADMIN;
    const www = await call(
      "localhost",
      "POST",
      "/admin/tenants",
      { slug: "www", name: "x", ownerPhone: phoneOf(9) },
      undefined,
      admin,
    );
    const dup = await call(
      "localhost",
      "POST",
      "/admin/tenants",
      { slug: slugA, name: "x", ownerPhone: phoneOf(9) },
      undefined,
      admin,
    );
    expect([www.status, dup.status]).toEqual([400, 409]);
  });
});

describe("tenant resolution", () => {
  test("unknown host is 404", async () => {
    expect((await call("nope-zz.localhost", "GET", "/tenant")).status).toBe(404);
  });
  test("subdomain gives public branding", async () => {
    const r = await call(hostA, "GET", "/tenant");
    expect(r.json).toMatchObject({ slug: slugA, name: "A", defaultLang: "en" });
  });
});

describe("OTP login", () => {
  test("new account needs consent", async () => {
    const phone = phoneOf(10);
    await call(hostA, "POST", "/auth/otp", { phone });
    const code = await redis.get<string>(`otp:${tenantA}:${phone}`);
    expect((await call(hostA, "POST", "/auth/verify", { phone, code })).status).toBe(400);
    const ok = await call(hostA, "POST", "/auth/verify", { phone, code, consent: true });
    expect(ok.status).toBe(200);
    expect(ok.json.user.role).toBe("customer");
  });

  const verify = async (phone: string, code: string) =>
    (await call(hostA, "POST", "/auth/verify", { phone, code, consent: true })).status;

  test("code is single-use", async () => {
    const phone = phoneOf(11);
    await call(hostA, "POST", "/auth/otp", { phone });
    const code = (await redis.get<string>(`otp:${tenantA}:${phone}`))!;
    expect(await verify(phone, code)).toBe(200);
    expect(await verify(phone, code)).toBe(401);
  });

  test("5 wrong codes lock out even the right one", async () => {
    const phone = phoneOf(17);
    await call(hostA, "POST", "/auth/otp", { phone });
    const code = (await redis.get<string>(`otp:${tenantA}:${phone}`))!;
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(await verify(phone, wrong)).toBe(401);
    expect(await verify(phone, code)).toBe(429);
  });

  test("resend cooldown", async () => {
    const phone = phoneOf(12);
    expect((await call(hostA, "POST", "/auth/otp", { phone })).status).toBe(200);
    expect((await call(hostA, "POST", "/auth/otp", { phone })).status).toBe(429);
  });

  test("GET /me says who is logged in", async () => {
    const phone = phoneOf(19);
    const cookie = await login(hostA, tenantA, phone);
    expect((await call(hostA, "GET", "/me", undefined, cookie)).json).toMatchObject({
      role: "customer",
      phone,
    });
    expect((await call(hostA, "GET", "/me")).status).toBe(401);
  });

  test("a session from tenant A is not valid on tenant B", async () => {
    const cookie = await login(hostA, tenantA, phoneOf(13));
    expect((await call(hostA, "GET", "/profiles", undefined, cookie)).status).toBe(200);
    expect((await call(hostB, "GET", "/profiles", undefined, cookie)).status).toBe(401);
  });

  test("password login after setting one", async () => {
    const phone = phoneOf(14);
    const cookie = await login(hostA, tenantA, phone);
    expect(
      (await call(hostA, "POST", "/auth/password", { password: "correct horse battery" }, cookie))
        .status,
    ).toBe(200);
    expect(
      (await call(hostA, "POST", "/auth/password/login", { phone, password: "nope" })).status,
    ).toBe(401);
    const ok = await call(hostA, "POST", "/auth/password/login", {
      phone,
      password: "correct horse battery",
    });
    expect(ok.status).toBe(200);
  });
});

describe("tenant settings and roles", () => {
  test("owner can update settings; customer cannot", async () => {
    const ownerCookie = await login(hostA, tenantA, phoneOf(1));
    const ok = await call(
      hostA,
      "PATCH",
      "/tenant",
      {
        brandColor: "#112233",
        enabledLangs: ["en", "hi"],
        defaultLang: "hi",
        kundliPricePaise: 49900,
      },
      ownerCookie,
    );
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({
      brandColor: "#112233",
      defaultLang: "hi",
      kundliPricePaise: 49900,
    });

    const bad = await call(hostA, "PATCH", "/tenant", { enabledLangs: ["en"] }, ownerCookie);
    expect(bad.status).toBe(400); // default "hi" would no longer be enabled

    const unknown = await call(hostA, "PATCH", "/tenant", { plan: "free" }, ownerCookie);
    expect(unknown.status).toBe(400);

    const customer = await login(hostA, tenantA, phoneOf(15));
    expect((await call(hostA, "PATCH", "/tenant", { name: "x" }, customer)).status).toBe(403);
  });

  // A hostile page can only send "simple" cross-site requests (form / text/plain) without a CORS
  // preflight, which we never grant. Those are what the CSRF check blocks.
  test("cross-site form-style write is rejected", async () => {
    const r = await call(hostA, "POST", "/auth/otp", { phone: phoneOf(16) }, undefined, {
      origin: "https://evil.example",
      "content-type": "text/plain",
    });
    expect(r.status).toBe(403);
  });
});

describe("profiles and DPDP", () => {
  test("place search in English and Devanagari", async () => {
    const en = await call(hostA, "GET", `/places?q=Testpur${run}`);
    const hi = await call(hostA, "GET", `/places?q=${encodeURIComponent(`टेस्टपुर${run}`)}`);
    expect(en.json[0]?.id).toBe(PLACE);
    expect(hi.json[0]?.id).toBe(PLACE);
  });

  test("create, visibility, export, delete", async () => {
    const custPhone = phoneOf(20);
    const cust = await login(hostA, tenantA, custPhone);
    const other = await login(hostA, tenantA, phoneOf(21));

    const created = await call(
      hostA,
      "POST",
      "/profiles",
      { name: "Asha", gender: "female", date: "1943-06-15", time: "10:00", placeId: PLACE },
      cust,
    );
    expect(created.status).toBe(201);
    expect(new Date(created.json.birthUtc).toISOString()).toBe("1943-06-15T03:30:00.000Z"); // war time +6:30
    const id = created.json.id;

    const unknownTime = await call(
      hostA,
      "POST",
      "/profiles",
      { name: "Ravi", gender: "male", date: "1990-01-01", time: null, placeId: PLACE },
      cust,
    );
    expect(unknownTime.json.timeKnown).toBe(false);

    expect((await call(hostA, "GET", `/profiles/${id}`, undefined, other)).status).toBe(404);

    // Owner adds an astrologer, who can see the customer's profile.
    const ownerCookie = await login(hostA, tenantA, phoneOf(1));
    const astroPhone = phoneOf(22);
    expect(
      (
        await call(
          hostA,
          "POST",
          "/tenant/staff",
          { phone: astroPhone, role: "astrologer" },
          ownerCookie,
        )
      ).status,
    ).toBe(201);
    const astro = await login(hostA, tenantA, astroPhone);
    expect((await call(hostA, "GET", `/profiles/${id}`, undefined, astro)).status).toBe(200);
    expect((await call(hostA, "PATCH", "/tenant", { name: "x" }, astro)).status).toBe(403);

    const exp = await call(hostA, "GET", "/me/export", undefined, cust);
    expect(exp.json.profiles).toHaveLength(2);
    expect(exp.json.user.passwordHash).toBeUndefined();

    expect((await call(hostA, "DELETE", "/me", undefined, cust)).status).toBe(204);
    expect((await call(hostA, "GET", `/profiles/${id}`, undefined, astro)).status).toBe(404);
    expect((await call(hostA, "GET", "/profiles", undefined, cust)).status).toBe(401);
  });

  test("bad birth input is 400", async () => {
    const cust = await login(hostA, tenantA, phoneOf(23));
    const future = await call(
      hostA,
      "POST",
      "/profiles",
      { name: "x", gender: "male", date: "2999-01-01", time: null, placeId: PLACE },
      cust,
    );
    const noPlace = await call(
      hostA,
      "POST",
      "/profiles",
      { name: "x", gender: "male", date: "1990-01-01", time: null, placeId: 1 },
      cust,
    );
    expect([future.status, noPlace.status]).toEqual([400, 400]);
  });
});
