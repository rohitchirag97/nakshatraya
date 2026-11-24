import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PLATFORM_NAME, platformIcons } from "@/components/Platform";
import {
  type Application,
  PlatformAdmin,
  PlatformLogin,
  type TenantRow,
} from "@/components/PlatformAdmin";
import { api, apiJson } from "@/lib/api";

export const metadata: Metadata = {
  title: `${PLATFORM_NAME} admin`,
  icons: platformIcons,
  robots: { index: false },
};

/** Our own admin panel, only on the platform host (never on a tenant's site). */
export default async function PlatformPage() {
  if ((await api("/api/tenant")).status !== 404) notFound();
  const me = await apiJson<{ phone: string }>("/api/admin/me");
  if (me.status !== 200)
    return (
      <div className="adm-login">
        <div className="adm-login-art" aria-hidden="true">
          <img src="/brand/nakshtraya-mascot.png" alt="" width={480} height={480} />
          <p>Everything your astrologers sell, in one place.</p>
        </div>
        <div className="adm-login-form">
          <img
            className="adm-login-logo"
            src="/brand/nakshtraya-logo.png"
            alt={PLATFORM_NAME}
            width={494}
            height={144}
          />
          <PlatformLogin />
        </div>
      </div>
    );

  const [tenants, apps, settings] = await Promise.all([
    apiJson<TenantRow[]>("/api/admin/tenants"),
    apiJson<Application[]>("/api/admin/applications"),
    apiJson<{ reportFeePaise: number }>("/api/admin/settings"),
  ]);
  // Tenant sites are <slug>.<platform root>; the panel may run on admin.<root> or www.<root>.
  const h = await headers();
  const host = h.get("x-tenant-host") ?? h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const siteBase = `${proto}://{slug}.${host.replace(/^(admin|www)\./, "")}`;

  return (
    <PlatformAdmin
      tenants={tenants.data ?? []}
      apps={apps.data ?? []}
      siteBase={siteBase}
      feePaise={settings.data?.reportFeePaise ?? 1000}
      adminPhone={me.data.phone}
    />
  );
}
