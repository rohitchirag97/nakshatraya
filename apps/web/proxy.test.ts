import { afterEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const req = (secret?: string) =>
  new NextRequest("https://x.vercel.app/report/1", {
    headers: secret ? { "x-proxy-secret": secret } : {},
  });

afterEach(() => {
  delete process.env.WEB_PROXY_SECRET;
});

test("without a configured secret (dev) everything passes", () => {
  expect(proxy(req()).status).toBe(200);
});

test("with a secret, only the Worker's requests pass", () => {
  process.env.WEB_PROXY_SECRET = "s3cret";
  expect(proxy(req("s3cret")).status).toBe(200);
  expect(proxy(req("s3cre")).status).toBe(404);
  expect(proxy(req("s3cretX")).status).toBe(404);
  expect(proxy(req()).status).toBe(404);
});
