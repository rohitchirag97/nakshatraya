import { notFound, redirect } from "next/navigation";
import { getMe, Shell } from "@/components/Shell";
import { apiJson, type PublicTenant } from "@/lib/api";
import { inr, langName, locale, tr } from "@/lib/i18n";

interface Invoice {
  kind: "tax-invoice" | "bill-of-supply";
  invoiceNo: string;
  date: string;
  seller: {
    name: string;
    tradeName: string;
    gstin: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  item: { kind: "pdf" | "print"; lang: string | null; sac: string; quantity: number };
  amountPaise: number;
  taxablePaise: number;
  cgst: number;
  sgst: number;
  payment: { method: "razorpay" | "cash" | "card" | "upi" | "other" | "test"; ref: string | null };
}

// FR-23: GST invoice in the tenant's name. The browser's print dialog saves it as PDF.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenant, inv, me] = await Promise.all([
    apiJson<PublicTenant>("/api/tenant"),
    apiJson<Invoice>(`/api/orders/${encodeURIComponent(id)}`),
    getMe(),
  ]);
  if (inv.status === 401) redirect("/login");
  if (inv.status !== 200 || tenant.status !== 200) notFound();
  const lang = tenant.data.defaultLang;
  const t = tr(lang);
  const i = inv.data;
  const money = (p: number) => inr(p, lang);
  const tax = i.kind === "tax-invoice";
  return (
    <Shell tenant={tenant.data} me={me}>
      <main className="page-main">
        <div className="container">
          <article className="card doc">
            <div className="invoice-head">
              <div>
                <span className="eyebrow" style={{ color: "var(--brand)" }}>
                  {tax ? t("inv.taxInvoice") : t("inv.billOfSupply")}
                </span>
                <h1 style={{ fontSize: "1.8rem", marginTop: 8 }}>{i.seller.name}</h1>
                <p className="muted" style={{ margin: 0 }}>
                  {i.seller.name !== i.seller.tradeName && `${i.seller.tradeName} · `}
                  {i.seller.address}
                  <br />
                  {[i.seller.phone, i.seller.email].filter(Boolean).join(" · ")}
                  {i.seller.gstin && (
                    <>
                      <br />
                      {t("inv.gstin")}: <strong>{i.seller.gstin}</strong>
                    </>
                  )}
                </p>
              </div>
              <dl style={{ margin: 0, textAlign: "right" }}>
                <dt className="muted small">{t("inv.invoiceNo")}</dt>
                <dd style={{ margin: "0 0 8px", fontWeight: 700 }}>{i.invoiceNo}</dd>
                <dt className="muted small">{t("inv.date")}</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                  {new Date(i.date).toLocaleDateString(locale(lang), {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "long",
                  })}
                </dd>
              </dl>
            </div>
            <div className="table-wrap" style={{ marginTop: 28 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t("inv.item")}</th>
                    <th>{t("inv.sac")}</th>
                    <th className="num">{tax ? t("inv.taxable") : t("inv.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {i.item.kind === "print" ? t("inv.itemPrint") : t("inv.itemPdf")}
                      {i.item.lang ? ` (${langName(i.item.lang)})` : ""} × {i.item.quantity}
                    </td>
                    <td>{i.item.sac}</td>
                    <td className="num">{money(i.taxablePaise)}</td>
                  </tr>
                  {tax && (
                    <tr>
                      <td colSpan={2}>{t("inv.cgst")}</td>
                      <td className="num">{money(i.cgst)}</td>
                    </tr>
                  )}
                  {tax && (
                    <tr>
                      <td colSpan={2}>{t("inv.sgst")}</td>
                      <td className="num">{money(i.sgst)}</td>
                    </tr>
                  )}
                  <tr className="total-row">
                    <td colSpan={2}>{t("inv.total")}</td>
                    <td className="num">{money(i.amountPaise)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {!tax && <p className="muted small">{t("inv.notRegistered")}</p>}
            <p className="muted small">
              {t("inv.paidBy")}: {t(`inv.method.${i.payment.method}`)}
              {i.payment.ref ? ` · ${t("inv.paymentId")} ${i.payment.ref}` : ""}
            </p>
          </article>
        </div>
      </main>
    </Shell>
  );
}
