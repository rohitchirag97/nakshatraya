import { notFound, redirect } from "next/navigation";
import { PrintStudio } from "@/components/PrintStudio";
import { getMe, Shell } from "@/components/Shell";
import { apiJson, type PublicTenant } from "@/lib/api";
import type { ReportView } from "@/lib/types";

/** Tenant staff print a kundli: paper size, booklet, own cover, preview, then the print dialog. */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenant, me] = await Promise.all([apiJson<PublicTenant>("/api/tenant"), getMe()]);
  if (tenant.status !== 200) notFound();
  if (!me) redirect("/login");
  if (me.role === "customer") notFound();
  const r = await apiJson<ReportView>(`/api/reports/${encodeURIComponent(id)}`);
  if (r.status !== 200) notFound();

  return (
    <Shell tenant={tenant.data} me={me} active="app">
      <main className="page-main">
        <div className="container">
          <div className="page-head">
            <div>
              <h1>Print kundli</h1>
              <p className="muted" style={{ margin: 0 }}>
                {r.data.profile.name} · {r.data.lang.toUpperCase()}
              </p>
            </div>
            <a className="btn btn-ghost" href="/app">
              Back
            </a>
          </div>
          <PrintStudio reportId={id} />
        </div>
      </main>
    </Shell>
  );
}
