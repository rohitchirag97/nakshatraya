import type { CSSProperties, ReactNode } from "react";
import { apiJson, type PublicTenant } from "@/lib/api";
import { tr } from "@/lib/i18n";
import { LogoutButton } from "./LogoutButton";

export interface Me {
  id: string;
  role: "owner" | "astrologer" | "customer";
  phone: string;
}

/** Who is logged in on this tenant, or null. */
export async function getMe() {
  const r = await apiJson<Me>("/api/me");
  return r.status === 200 ? r.data : null;
}

/** Header + footer + tenant colours around every app page. */
export function Shell({
  tenant,
  me,
  active,
  children,
}: {
  tenant: PublicTenant;
  me: Me | null;
  active?: "app" | "admin" | "accuracy";
  children: ReactNode;
}) {
  const t = tr(tenant.defaultLang);
  const cur = (k: string) => (active === k ? "page" : undefined);
  return (
    <div className="tenant" style={{ "--brand": tenant.brandColor } as CSSProperties}>
      <header className="site-header">
        <div className="container">
          <a className="brand-mark" href="/">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt="" />
            ) : (
              <span className="seal" aria-hidden="true">
                ✦
              </span>
            )}
            <span>{tenant.name}</span>
          </a>
          <nav className="nav" aria-label="Main">
            <a className="hide-sm" href="/accuracy" aria-current={cur("accuracy")}>
              {t("ui.accuracy")}
            </a>
            {me && (
              <a href="/app" aria-current={cur("app")}>
                {t("ui.myKundlis")}
              </a>
            )}
            {me?.role === "owner" && (
              <a href="/admin" aria-current={cur("admin")}>
                {t("ui.sales")}
              </a>
            )}
            {me ? (
              <LogoutButton label={t("ui.logout")} />
            ) : (
              <a className="btn btn-primary btn-sm" href="/login">
                {t("ui.login")}
              </a>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="container">
          <span>
            © {tenant.name}
            {tenant.contactPhone ? ` · ${tenant.contactPhone}` : ""}
            {tenant.contactEmail ? ` · ${tenant.contactEmail}` : ""}
          </span>
          <span>
            <a href="/accuracy">{t("ui.accuracy")}</a> · {t("placesCredit")}
          </span>
        </div>
      </footer>
    </div>
  );
}
