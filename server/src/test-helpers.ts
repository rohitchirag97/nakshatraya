// Shared by the integration tests. Needs Postgres (migrated) and the Upstash-compatible Redis proxy
// from docker-compose; see README.
import { expect } from "bun:test";
import { CONTENT_KEYS } from "@jyotish/engine";
import { Redis } from "@upstash/redis";
import postgres from "postgres";
import type { Bindings } from "./context";
import { app } from "./index";

// In-memory stand-in for the R2 bucket.
export const r2 = new Map<string, Uint8Array<ArrayBuffer>>();
const fakeR2 = {
  async get(key: string) {
    const v = r2.get(key);
    return v ? { body: new Blob([v]).stream() } : null;
  },
  async put(key: string, value: Uint8Array) {
    r2.set(key, new Uint8Array(value));
  },
};

export const env = {
  HYPERDRIVE: { connectionString: process.env.DATABASE_URL! },
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
  APP_DOMAIN: "localhost",
  ENVIRONMENT: "development",
  PLATFORM_ADMIN_TOKEN: "test-admin-token",
  REPORT_TOKEN_SECRET: "test-report-secret",
  WEB_ORIGIN: "http://{host}:3001",
  REPORTS: fakeR2,
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "test-key-secret",
  RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
} as unknown as Bindings;

export const owner = postgres(process.env.DATABASE_OWNER_URL!);

// Reviewed placeholder text for every key, tagged so it can be removed. Never overwrites real text.
const FIXTURE = "test-fixture";
export async function seedContent(lang: string) {
  const rows = CONTENT_KEYS.map((key) => ({
    key,
    lang,
    text: `[${lang}] ${key}`,
    reviewed_by: FIXTURE,
    reviewed_at: new Date(),
  }));
  await owner`insert into content ${owner(rows)} on conflict do nothing`;
}
export const clearContent = () => owner`delete from content where reviewed_by = ${FIXTURE}`;

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization: false,
});

export const ADMIN = { authorization: "Bearer test-admin-token" };

export async function call(
  host: string,
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
  headers: Record<string, string> = {},
  bindings: Bindings = env,
) {
  const res = await app.request(
    `/api${path}`,
    {
      method,
      headers: {
        host,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    bindings,
  );
  const sid = res.headers.get("set-cookie")?.match(/sid=([^;]*)/)?.[1];
  const isJson = res.headers.get("content-type")?.includes("json");
  const raw = isJson ? await res.text() : null;
  return {
    status: res.status,
    json: raw ? JSON.parse(raw) : null,
    res,
    cookie: sid ? `sid=${sid}` : undefined,
  };
}

export async function login(host: string, tenantId: string, phone: string, consent = true) {
  await redis.del(`otp-cd:${tenantId}:${phone}`); // skip the 30 s resend cooldown between logins
  await call(host, "POST", "/auth/otp", { phone });
  const code = await redis.get<string>(`otp:${tenantId}:${phone}`);
  const r = await call(host, "POST", "/auth/verify", { phone, code, consent });
  expect(r.status).toBe(200);
  return r.cookie!;
}

/** Wallet credit for a test tenant (every kundli costs the platform fee). */
export const fund = (slug: string, amountPaise = 100_000) =>
  call("localhost", "POST", `/admin/tenants/${slug}/credit`, { amountPaise }, undefined, ADMIN);
