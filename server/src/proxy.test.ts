// The Worker front door: /api stays here, everything else goes to the web app with tenant + secret.
import { afterAll, expect, test } from "bun:test";
import worker from "./index";
import { env } from "./test-helpers";

const seen: { url: string; headers: Headers; body: string }[] = [];
const upstream = Bun.serve({
  port: 0,
  async fetch(req) {
    seen.push({ url: req.url, headers: req.headers, body: await req.text() });
    return new Response("from web", { status: 307, headers: { location: "/login" } });
  },
});
afterAll(() => upstream.stop());

const bindings = { ...env, WEB_UPSTREAM: upstream.url.origin, WEB_PROXY_SECRET: "proxy-secret" };
const ctx = { waitUntil() {}, passThroughOnException() {} } as never;

test("non-API paths go to the web app with tenant host and secret; client copies are overwritten", async () => {
  const res = await worker.fetch(
    new Request("https://demo.ourapp.in/report/abc?t=1", {
      headers: { "x-tenant-host": "evil.ourapp.in", "x-proxy-secret": "guess", cookie: "sid=1" },
    }),
    bindings,
    ctx,
  );
  expect(res.status).toBe(307); // redirect passed through, not followed
  expect(res.headers.get("location")).toBe("/login");
  const r = seen.at(-1)!;
  expect(new URL(r.url).pathname + new URL(r.url).search).toBe("/report/abc?t=1");
  expect(r.headers.get("x-tenant-host")).toBe("demo.ourapp.in");
  expect(r.headers.get("x-proxy-secret")).toBe("proxy-secret");
  expect(r.headers.get("cookie")).toBe("sid=1");
});

test("form posts keep their body", async () => {
  await worker.fetch(
    new Request("https://demo.ourapp.in/x", { method: "POST", body: "a=1" }),
    bindings,
    ctx,
  );
  expect(seen.at(-1)!.body).toBe("a=1");
});

test("/api stays in this Worker", async () => {
  const before = seen.length;
  const res = await worker.fetch(
    new Request("https://nope-zz.localhost/api/tenant"),
    bindings,
    ctx,
  );
  expect(res.status).toBe(404); // our API: unknown tenant
  expect(await res.json()).toEqual({ error: "unknown tenant" });
  expect(seen.length).toBe(before);
});
