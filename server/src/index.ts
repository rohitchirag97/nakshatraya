import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./auth";
import {
  type Bindings,
  type Env,
  loadSession,
  resolveTenant,
  services,
  tenantHost,
} from "./context";
import { paymentRoutes, webhookRoutes } from "./payments";
import { adminRoutes, applyRoutes } from "./platform";
import { meRoutes, placeRoutes, profileRoutes } from "./profiles";
import { reportRoutes } from "./reports";
import { orderRoutes, salesRoutes } from "./sales";
import { tenantRoutes } from "./tenant";
import { walletRoutes } from "./topup";

// Everything under here runs on a tenant host (brand.<APP_DOMAIN> or a custom domain).
const tenantApi = new Hono<Env>()
  .use(resolveTenant, loadSession)
  .route("/auth", auth)
  .route("/tenant", tenantRoutes)
  .route("/places", placeRoutes)
  .route("/profiles", profileRoutes)
  .route("/me", meRoutes)
  .route("/reports", reportRoutes)
  .route("/", paymentRoutes)
  .route("/orders", orderRoutes)
  .route("/tenant", salesRoutes)
  .route("/tenant/wallet", walletRoutes);

// Served on each tenant host under /api (Workers route *.ourapp.in/api/*), so the browser talks
// to it same-origin: no CORS, and the session cookie stays host-only.
export const app = new Hono<Env>()
  .basePath("/api")
  .use(secureHeaders())
  // Cookie sessions: reject cross-site writes by checking Origin against the tenant host.
  .use(
    csrf({
      origin: (origin, c) => URL.canParse(origin) && new URL(origin).hostname === tenantHost(c),
    }),
  )
  .use(services)
  .get("/health", async (c) => {
    const [db, cache] = await Promise.allSettled([c.var.db.client`select 1`, c.var.redis.ping()]);
    const ok = db.status === "fulfilled" && cache.status === "fulfilled";
    return c.json({ db: db.status, redis: cache.status }, ok ? 200 : 503);
  })
  .route("/admin", adminRoutes)
  // Platform website: astrologers apply to join (no tenant host).
  .route("/apply", applyRoutes)
  // Razorpay calls one URL for every tenant; no tenant host, no session.
  .route("/razorpay/webhook", webhookRoutes)
  .route("/", tenantApi);

app.onError((err, c) => {
  // csrf 403, malformed body 400, ...: keep the status, answer in JSON like every other error.
  if (err instanceof HTTPException)
    return c.json({ error: err.message || "request rejected" }, err.status);
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

/**
 * Front door for *.ourapp.in: /api/* is this Worker; every other path is the Next.js app on Vercel.
 * Vercel only does wildcard subdomains on its own DNS, so it gets one fixed upstream URL and learns the
 * tenant from X-Tenant-Host. The shared secret makes the Next app refuse anything that skipped this hop.
 */
export async function proxyToWeb(req: Request, env: Bindings) {
  const url = new URL(req.url);
  const headers = new Headers(req.headers);
  headers.set("x-tenant-host", url.host); // overwrites anything the client sent
  headers.set("x-proxy-secret", env.WEB_PROXY_SECRET ?? "");
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return fetch(new URL(url.pathname + url.search, env.WEB_UPSTREAM), {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    redirect: "manual", // pass Next's redirects (e.g. to /login) through to the browser
  });
}

export default {
  fetch(req: Request, env: Bindings, ctx: Parameters<typeof app.fetch>[2]) {
    const { pathname } = new URL(req.url);
    const api = pathname === "/api" || pathname.startsWith("/api/");
    return api || !env.WEB_UPSTREAM ? app.fetch(req, env, ctx) : proxyToWeb(req, env);
  },
};
