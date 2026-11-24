// Type-only module import: the ambient workers-types globals clash with bun-types in one tsconfig.

import type { BrowserWorker } from "@cloudflare/playwright";
import type { R2Bucket } from "@cloudflare/workers-types/index";
import { createDb, type Db, tenants } from "@jyotish/db";
import { Redis } from "@upstash/redis/cloudflare";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

export interface Bindings {
  HYPERDRIVE: { connectionString: string };
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  APP_DOMAIN: string;
  ENVIRONMENT: "development" | "production";
  PLATFORM_ADMIN_TOKEN: string;
  /** HMAC key for the short-lived links the PDF browser uses to open a report page. */
  REPORT_TOKEN_SECRET: string;
  /** Where the Next.js app answers, e.g. "https://{host}" or "http://{host}:3001" in dev. */
  WEB_ORIGIN: string;
  /** Production: the Next.js app (e.g. https://jyotish-web.vercel.app); non-/api paths are proxied there. */
  WEB_UPSTREAM?: string;
  /** Shared with the Next.js app so it only answers requests that came through this Worker. */
  WEB_PROXY_SECRET?: string;
  /** Dev only: "1" makes Pay mark orders paid without Razorpay (ignored when ENVIRONMENT=production). */
  DEV_FAKE_PAYMENTS?: string;
  /** Dev only: trust X-Forwarded-Host from the Next.js dev proxy. */
  TRUST_FORWARDED_HOST?: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  BROWSER: BrowserWorker;
  REPORTS: R2Bucket;
}

export type Tenant = typeof tenants.$inferSelect;
export type Role = "owner" | "astrologer" | "customer";
export interface Session {
  userId: string;
  tenantId: string;
  role: Role;
}
export type Env = {
  Bindings: Bindings;
  Variables: {
    tenant: Tenant;
    session: Session | null;
    db: Db;
    redis: Redis;
    /** Platform admin routes: the logged-in admin's phone ("token" for bearer-token scripts). */
    adminPhone: string;
  };
};

/** Per-request Postgres (through Hyperdrive) and Upstash clients. */
export const services = createMiddleware<Env>(async (c, next) => {
  const db = createDb(c.env.HYPERDRIVE.connectionString);
  c.set("db", db);
  c.set(
    "redis",
    // Values stay strings: auto-deserialising would turn "012345" OTPs into numbers.
    new Redis({
      url: c.env.UPSTASH_REDIS_REST_URL,
      token: c.env.UPSTASH_REDIS_REST_TOKEN,
      automaticDeserialization: false,
    }),
  );
  try {
    await next();
  } finally {
    const end = db.client.end();
    try {
      c.executionCtx.waitUntil(end);
    } catch {
      await end; // no execution context outside workerd (bun test)
    }
  }
});

export const tenantHost = (c: Context<Env>) =>
  (
    (c.env.TRUST_FORWARDED_HOST === "1" && c.req.header("x-forwarded-host")) ||
    c.req.header("host") ||
    ""
  )
    .split(":")[0]!
    .toLowerCase();

/** brand.<APP_DOMAIN> → tenant by slug; any other host → tenant by custom domain. */
export const resolveTenant = createMiddleware<Env>(async (c, next) => {
  const host = tenantHost(c);
  const suffix = `.${c.env.APP_DOMAIN.toLowerCase()}`;
  const where = host.endsWith(suffix)
    ? eq(tenants.slug, host.slice(0, -suffix.length))
    : eq(tenants.domain, host);
  // shortcut: one indexed query per request; cache in Redis if it shows up in latency.
  const [tenant] = await c.var.db.db.select().from(tenants).where(where).limit(1);
  if (!tenant) return c.json({ error: "unknown tenant" }, 404);
  c.set("tenant", tenant);
  await next();
});

const COOKIE = "sid";
const SESSION_TTL = 30 * 86400;
const key = (token: string) => `sess:${token}`;

export const randomHex = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function startSession(c: Context<Env>, s: Session) {
  const token = randomHex(32);
  await c.var.redis.set(key(token), JSON.stringify(s), { ex: SESSION_TTL });
  // Host-only cookie: a session for brand-a.ourapp.in is never sent to brand-b.
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function endSession(c: Context<Env>) {
  const token = getCookie(c, COOKIE);
  if (token) await c.var.redis.del(key(token));
  deleteCookie(c, COOKIE, { path: "/" });
}

export const loadSession = createMiddleware<Env>(async (c, next) => {
  const token = getCookie(c, COOKIE);
  const raw = token ? await c.var.redis.get<string>(key(token)) : null;
  const s: Session | null = raw ? JSON.parse(raw) : null;
  // A session only counts on the tenant it was created for.
  c.set("session", s && s.tenantId === c.get("tenant").id ? s : null);
  await next();
});

export const requireRole = (...roles: Role[]) =>
  createMiddleware<Env>(async (c, next) => {
    const s = c.get("session");
    if (!s) return c.json({ error: "login required" }, 401);
    if (!roles.includes(s.role)) return c.json({ error: "forbidden" }, 403);
    await next();
  });

export const anyUser = requireRole("owner", "astrologer", "customer");
export const staff = requireRole("owner", "astrologer");

/** Fixed-window counter. Returns false once `max` hits happen within `windowSec`. */
export async function rateLimit(c: Context<Env>, name: string, max: number, windowSec: number) {
  const k = `rl:${name}`;
  const n = await c.var.redis.incr(k);
  if (n === 1) await c.var.redis.expire(k, windowSec);
  return n <= max;
}

export const session = (c: Context<Env>) => c.get("session")!;
