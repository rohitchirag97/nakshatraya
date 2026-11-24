import { notFound, redirect } from "next/navigation";
import Script from "next/script";
import { Dashboard, type OrderRow, type Person, type ReportRow } from "@/components/Dashboard";
import { getMe, Shell } from "@/components/Shell";
import { apiJson, type PublicTenant } from "@/lib/api";
import { tr } from "@/lib/i18n";

export default async function AppPage() {
  const [tenant, people, reports, orders, me] = await Promise.all([
    apiJson<PublicTenant>("/api/tenant"),
    apiJson<Person[]>("/api/profiles"),
    apiJson<ReportRow[]>("/api/reports"),
    apiJson<OrderRow[]>("/api/orders"),
    getMe(),
  ]);
  if (tenant.status !== 200) notFound();
  if (people.status === 401 || !me) redirect("/login");
  const lang = tenant.data.defaultLang;
  return (
    <Shell tenant={tenant.data} me={me} active="app">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <main className="page-main">
        <div className="container">
          <div className="page-head">
            <h1>{tr(lang)("ui.myKundlis")}</h1>
          </div>
          <Dashboard
            lang={lang}
            tenant={tenant.data}
            people={people.data}
            reports={reports.data}
            orders={orders.data}
            staff={me.role !== "customer"}
          />
        </div>
      </main>
    </Shell>
  );
}
