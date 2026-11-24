// Phase 3 integration tests: report creation, access, frozen text, PDF caching.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { pdf } from "./reports";
import { ADMIN, call, clearContent, fund, login, owner, r2, seedContent } from "./test-helpers";

const run = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
const phoneOf = (n: number) => `+9191${run}${String(n).padStart(2, "0")}`;
const host = `rp-${run}.localhost`;
const otherHost = `rq-${run}.localhost`;
const PLACE = 910_000_000 + Number(run);
let tenant = "";
let other = "";

beforeAll(async () => {
  await seedContent("en");
  const a = await call(
    "localhost",
    "POST",
    "/admin/tenants",
    { slug: `rp-${run}`, name: "RP", ownerPhone: phoneOf(1) },
    undefined,
    ADMIN,
  );
  const b = await call(
    "localhost",
    "POST",
    "/admin/tenants",
    { slug: `rq-${run}`, name: "RQ", ownerPhone: phoneOf(2) },
    undefined,
    ADMIN,
  );
  tenant = a.json.id;
  other = b.json.id;
  await Promise.all([fund(`rp-${run}`), fund(`rq-${run}`)]);
  // A priced tenant, so customers' reports start locked (a ₹0 price makes them free).
  await owner`update tenants set kundli_price_paise = 49900 where id = ${tenant}`;
  await owner`insert into places (id, name, admin1, country, lat, lon, tz, population)
    values (${PLACE}, ${`Reportpur${run}`}, 'Delhi', 'IN', 28.65, 77.23, 'Asia/Kolkata', 20000)`;
});

afterAll(async () => {
  await owner`delete from profiles where place_id = ${PLACE}`;
  await owner`delete from places where id = ${PLACE}`;
  await clearContent();
});

const newProfile = (cookie: string, time: string | null = "10:00") =>
  call(
    host,
    "POST",
    "/profiles",
    { name: "Asha", gender: "female", date: "1990-01-01", time, placeId: PLACE },
    cookie,
  );

describe("languages go live only with complete text (FR-16)", () => {
  test("enabling Hindi needs every key reviewed", async () => {
    const ownerCookie = await login(host, tenant, phoneOf(1));
    await clearContent();
    await seedContent("en");
    const before = await call(
      host,
      "PATCH",
      "/tenant",
      { enabledLangs: ["en", "hi"] },
      ownerCookie,
    );
    // Passes only if real reviewed Hindi text is already complete in this database.
    if (before.status !== 200) expect(before.json.error).toContain("not complete");
    await seedContent("hi");
    const after = await call(host, "PATCH", "/tenant", { enabledLangs: ["en", "hi"] }, ownerCookie);
    expect(after.status).toBe(200);
  });

  test("report creation refuses a language that isn't enabled", async () => {
    const cookie = await login(otherHost, other, phoneOf(3));
    const p = await call(
      otherHost,
      "POST",
      "/profiles",
      { name: "x", gender: "male", date: "1990-01-01", time: null, placeId: PLACE },
      cookie,
    );
    const r = await call(
      otherHost,
      "POST",
      "/reports",
      { profileId: p.json.id, lang: "hi" },
      cookie,
    );
    expect(r.status).toBe(400);
  });
});

describe("reports", () => {
  test("customer report is locked until paid; text is frozen at creation", async () => {
    const cust = await login(host, tenant, phoneOf(10));
    const p = await newProfile(cust);
    const r = await call(host, "POST", "/reports", { profileId: p.json.id, lang: "en" }, cust);
    expect(r.status).toBe(201);
    expect(r.json.status).toBe("locked");

    const view = await call(host, "GET", `/reports/${r.json.id}`, undefined, cust);
    expect(view.status).toBe(402);

    // Staff can open it; it carries the stored chart and the text as it was at creation.
    const ownerCookie = await login(host, tenant, phoneOf(1));
    const staffView = await call(host, "GET", `/reports/${r.json.id}`, undefined, ownerCookie);
    expect(staffView.status).toBe(200);
    expect(staffView.json.chart.engineVersion).toBe("0.1.0");
    expect(staffView.json.sections.map((s: { id: string }) => s.id).slice(0, 5)).toEqual([
      "lagna",
      "planets",
      "moon",
      "dasha",
      "doshas",
    ]);
    expect(staffView.json.profile.place.name).toBe(`Reportpur${run}`);
    const first = staffView.json.sections[0].items[0];
    // Only touches fixture rows, never real text.
    await owner`update content set text = 'edited later' where key = ${first.key} and lang = 'en' and reviewed_by = 'test-fixture'`;
    const again = await call(host, "GET", `/reports/${r.json.id}`, undefined, ownerCookie);
    expect(again.json.sections[0].items[0].text).toBe(first.text);
  });

  test("unknown birth time: no lagna section", async () => {
    const astroPhone = phoneOf(11);
    const ownerCookie = await login(host, tenant, phoneOf(1));
    await call(
      host,
      "POST",
      "/tenant/staff",
      { phone: astroPhone, role: "astrologer" },
      ownerCookie,
    );
    const astro = await login(host, tenant, astroPhone);
    const p = await newProfile(astro, null);
    const r = await call(host, "POST", "/reports", { profileId: p.json.id, lang: "en" }, astro);
    expect(r.json.status).toBe("ready"); // staff reports are free (FR-21)
    const v = await call(host, "GET", `/reports/${r.json.id}`, undefined, astro);
    expect(v.json.chart.lagna).toBeNull();
    expect(v.json.sections.map((s: { id: string }) => s.id)).not.toContain("lagna");
  });

  test("other customers, other tenants and anonymous users can't see a report", async () => {
    const cust = await login(host, tenant, phoneOf(12));
    const p = await newProfile(cust);
    const { json } = await call(
      host,
      "POST",
      "/reports",
      { profileId: p.json.id, lang: "en" },
      cust,
    );
    const stranger = await login(host, tenant, phoneOf(13));
    const otherTenantStaff = await login(otherHost, other, phoneOf(2));
    expect((await call(host, "GET", `/reports/${json.id}`, undefined, stranger)).status).toBe(404);
    expect(
      (await call(otherHost, "GET", `/reports/${json.id}`, undefined, otherTenantStaff)).status,
    ).toBe(404);
    expect((await call(host, "GET", `/reports/${json.id}`)).status).toBe(404);
    expect((await call(host, "GET", `/reports/${json.id}?t=123.abc`)).status).toBe(404);
    expect((await call(host, "GET", "/reports", undefined, stranger)).json).toEqual([]);
  });

  test("PDF: rendered once from a signed page link, then served from storage", async () => {
    const astro = await login(host, tenant, phoneOf(11));
    const p = await newProfile(astro);
    const { json } = await call(
      host,
      "POST",
      "/reports",
      { profileId: p.json.id, lang: "en" },
      astro,
    );

    const urls: string[] = [];
    const real = pdf.render;
    pdf.render = async (_b, url) => {
      urls.push(url);
      return new TextEncoder().encode("%PDF-fake");
    };
    try {
      const a = await call(host, "GET", `/reports/${json.id}/pdf`, undefined, astro);
      const b = await call(host, "GET", `/reports/${json.id}/pdf`, undefined, astro);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.res.headers.get("content-type")).toBe("application/pdf");
      expect(await b.res.text()).toBe("%PDF-fake");
      expect(urls).toHaveLength(1); // second download came from storage
      expect([...r2.keys()].some((k) => k.startsWith(`${tenant}/${json.id}/`))).toBe(true);

      // The browser opens the page with a token instead of a session.
      const u = new URL(urls[0]!);
      expect(u.host).toBe(`${host}:3001`);
      const viaToken = await call(host, "GET", `/reports/${json.id}?t=${u.searchParams.get("t")}`);
      expect(viaToken.status).toBe(200);
      // ...but the token doesn't work for another report or for downloading.
      const pdfViaToken = await call(
        host,
        "GET",
        `/reports/${json.id}/pdf?t=${u.searchParams.get("t")}`,
      );
      expect(pdfViaToken.status).toBe(404);
    } finally {
      pdf.render = real;
    }
  });

  test("print options: staff only, A5 rendered with its own layout, booklet only in A5", async () => {
    const astro = await login(host, tenant, phoneOf(11));
    const p = await newProfile(astro);
    const { json } = await call(
      host,
      "POST",
      "/reports",
      { profileId: p.json.id, lang: "en" },
      astro,
    );
    const urls: string[] = [];
    const real = pdf.render;
    pdf.render = async (_b, url, size) => {
      urls.push(url);
      const d = await PDFDocument.create();
      for (let i = 0; i < 6; i++)
        d.addPage(size === "a5" ? [419.53, 595.28] : [595.28, 841.89]).drawText(`p${i}`);
      return new Uint8Array(await d.save());
    };
    try {
      const booklet = await call(
        host,
        "GET",
        `/reports/${json.id}/pdf?size=a5&cover=0&layout=booklet`,
        undefined,
        astro,
      );
      expect(booklet.status).toBe(200);
      expect(booklet.res.headers.get("content-disposition")).toStartWith("inline");
      expect(urls[0]).toContain("&size=a5");
      const sheets = (await PDFDocument.load(await booklet.res.arrayBuffer())).getPageCount();
      expect(sheets).toBe(4); // 6 pages, cover dropped → 5 → padded to 8 → 2 sheets, 2 sides

      // Black and white is its own render (no paper texture), not the colour PDF reused.
      const bw = await call(
        host,
        "GET",
        `/reports/${json.id}/pdf?size=a5&color=bw`,
        undefined,
        astro,
      );
      expect(bw.status).toBe(200);
      expect(urls.at(-1)).toContain("&size=a5&bw=1");
      expect(bw.res.headers.get("content-disposition")).toContain("-bw.pdf");

      const a4Booklet = await call(
        host,
        "GET",
        `/reports/${json.id}/pdf?layout=booklet`,
        undefined,
        astro,
      );
      expect(a4Booklet.status).toBe(400);

      // Customers can download their kundli, but not ask for print layouts.
      const cust = await login(host, tenant, phoneOf(12));
      const cp = await newProfile(cust);
      const free = await call(
        host,
        "POST",
        "/reports",
        { profileId: cp.json.id, lang: "en" },
        cust,
      );
      await owner`update reports set status = 'ready' where id = ${free.json.id}`;
      const asked = await call(
        host,
        "GET",
        `/reports/${free.json.id}/pdf?size=a5`,
        undefined,
        cust,
      );
      expect(asked.status).toBe(403);
    } finally {
      pdf.render = real;
    }
  });

  test("PDF busy maps to 503 with retry-after", async () => {
    const astro = await login(host, tenant, phoneOf(11));
    const p = await newProfile(astro);
    const { json } = await call(
      host,
      "POST",
      "/reports",
      { profileId: p.json.id, lang: "en" },
      astro,
    );
    const real = pdf.render;
    pdf.render = async () => {
      throw new Error("Rate limit exceeded (429)");
    };
    try {
      const r = await call(host, "GET", `/reports/${json.id}/pdf`, undefined, astro);
      expect(r.status).toBe(503);
      expect(r.res.headers.get("retry-after")).toBe("5");
    } finally {
      pdf.render = real;
    }
  });

  test("locked report can't be downloaded either", async () => {
    const cust = await login(host, tenant, phoneOf(14));
    const p = await newProfile(cust);
    const { json } = await call(
      host,
      "POST",
      "/reports",
      { profileId: p.json.id, lang: "en" },
      cust,
    );
    expect((await call(host, "GET", `/reports/${json.id}/pdf`, undefined, cust)).status).toBe(402);
  });
});

describe("Gujarati", () => {
  test("goes live only with complete text, then reports can be made in it", async () => {
    const ownerCookie = await login(host, tenant, phoneOf(1));
    const before = await call(
      host,
      "PATCH",
      "/tenant",
      { enabledLangs: ["en", "hi", "gu"] },
      ownerCookie,
    );
    expect(before.status).toBe(400); // no reviewed Gujarati text in the test database yet
    await seedContent("gu");
    await seedContent("hi");
    const after = await call(
      host,
      "PATCH",
      "/tenant",
      { enabledLangs: ["en", "hi", "gu"] },
      ownerCookie,
    );
    expect(after.status).toBe(200);

    const p = await newProfile(ownerCookie);
    const r = await call(
      host,
      "POST",
      "/reports",
      { profileId: p.json.id, lang: "gu" },
      ownerCookie,
    );
    expect(r.status).toBe(201);
    const v = await call(host, "GET", `/reports/${r.json.id}`, undefined, ownerCookie);
    expect(v.json.lang).toBe("gu");
    expect(v.json.sections[0].items[0].text).toStartWith("[gu] ");
  });
});
