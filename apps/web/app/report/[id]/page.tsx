import { notFound } from "next/navigation";
import { createTranslator } from "next-intl";
import { Report } from "@/components/Report";
import { getMe, Shell } from "@/components/Shell";
import { api, apiJson, type PublicTenant } from "@/lib/api";
import { MESSAGES, tr } from "@/lib/i18n";
import type { ReportView } from "@/lib/types";

// One page for both the web view and the PDF (FR-12): Chromium opens it with ?t=<print token>
// and gets the bare report; visitors see it inside the site header and footer.
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; size?: string; bw?: string }>;
}) {
  const { id } = await params;
  const { t: token, size, bw } = await searchParams;
  const res = await api(
    `/api/reports/${encodeURIComponent(id)}${token ? `?t=${encodeURIComponent(token)}` : ""}`,
  );
  if (res.status === 404 || res.status === 401) notFound();

  if (token) {
    if (!res.ok) throw new Error(`report API ${res.status}`);
    const r: ReportView = await res.json();
    const t = createTranslator({ locale: r.lang, messages: MESSAGES[r.lang] });
    return <Report r={r} t={t} pdfHref={null} size={size === "a5" ? "a5" : "a4"} bw={bw === "1"} />;
  }

  const [tenant, me] = await Promise.all([apiJson<PublicTenant>("/api/tenant"), getMe()]);
  if (tenant.status !== 200) notFound();
  const ui = tr(tenant.data.defaultLang);

  if (res.status === 402) {
    return (
      <Shell tenant={tenant.data} me={me}>
        <main className="page-main">
          <div className="container">
            <div className="card doc" style={{ textAlign: "center", padding: 48 }}>
              <h2>{ui("locked")}</h2>
              <a className="btn btn-primary btn-lg" href="/app" style={{ marginTop: 12 }}>
                {ui("ui.back")}
              </a>
            </div>
          </div>
        </main>
      </Shell>
    );
  }
  if (!res.ok) throw new Error(`report API ${res.status}`);

  const r: ReportView = await res.json();
  const t = createTranslator({ locale: r.lang, messages: MESSAGES[r.lang] });
  return (
    <Shell tenant={tenant.data} me={me}>
      <Report r={r} t={t} pdfHref={`/api/reports/${r.id}/pdf`} backLabel={ui("ui.back")} />
    </Shell>
  );
}
