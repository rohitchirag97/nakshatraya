import { notFound } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Shell } from "@/components/Shell";
import { Wheel } from "@/components/Wheel";
import { apiJson, type PublicTenant } from "@/lib/api";
import { tr } from "@/lib/i18n";

export default async function LoginPage() {
  const { status, data: tenant } = await apiJson<PublicTenant>("/api/tenant");
  if (status !== 200) notFound();
  const t = tr(tenant.defaultLang);
  return (
    <Shell tenant={tenant} me={null}>
      <main className="auth">
        <section className="glow auth-side">
          <div style={{ position: "relative" }}>
            <span className="eyebrow">{t("home.eyebrow")}</span>
            <h1 style={{ marginTop: 16 }}>{t("auth.sideTitle")}</h1>
            <p className="muted">{t("auth.sideBody")}</p>
          </div>
          <Wheel />
        </section>
        <section className="auth-form">
          <div className="card">
            <h2>{t("ui.login")}</h2>
            <LoginForm lang={tenant.defaultLang} tenantName={tenant.name} />
          </div>
        </section>
      </main>
    </Shell>
  );
}
