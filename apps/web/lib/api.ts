import { headers } from "next/headers";

/** Server-side call to the Worker API for the current tenant host, forwarding the visitor's session. */
export async function api(path: string) {
  const h = await headers();
  // x-tenant-host: set by the Cloudflare Worker in production (proxy.ts rejects requests without its
  // secret). x-forwarded-host / host: local dev.
  const host = (h.get("x-tenant-host") ?? h.get("x-forwarded-host") ?? h.get("host") ?? "").split(
    ":",
  )[0]!;
  // Production: the API lives on the same host under /api. Dev: wrangler on localhost:8787.
  const origin = (process.env.API_ORIGIN ?? "https://{host}").replace("{host}", host);
  return fetch(`${origin}${path}`, {
    headers: { cookie: h.get("cookie") ?? "", "x-forwarded-host": host },
    cache: "no-store",
  });
}

/** api() + JSON, for pages that branch on status (401 → login, 403/404 → not found). */
export async function apiJson<T>(path: string): Promise<{ status: number; data: T }> {
  const res = await api(path);
  return { status: res.status, data: res.ok ? await res.json() : (null as T) };
}

export interface PublicTenant {
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  defaultLang: string;
  enabledLangs: string[];
  kundliPricePaise: number;
  printPricePaise: number;
  shopEnabled: boolean;
  consultEnabled: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
}
