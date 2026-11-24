import { notFound, redirect } from "next/navigation";
import Script from "next/script";
import { AdminSettings } from "@/components/AdminSettings";
import { type Branding, BrandingSettings } from "@/components/BrandingSettings";
import { Fulfilment, type PrintOrder } from "@/components/Fulfilment";
import { Download } from "@/components/Icons";
import { getMe, Shell } from "@/components/Shell";
import { Wallet, type WalletData } from "@/components/Wallet";
import { apiJson, type PublicTenant } from "@/lib/api";
import { inr } from "@/lib/i18n";

interface Settings extends Branding {
  slug: string;
  kundliPricePaise: number;
  printPricePaise: number;
  gstin: string | null;
  legalName: string | null;
  address: string | null;
  shopEnabled: boolean;
  consultEnabled: boolean;
  commissionBps: number;
  paymentsReady: boolean;
}
interface Month {
  month: string;
  orders: number;
  grossPaise: number;
  gstPaise: number;
  commissionPaise: number;
  yourSharePaise: number;
}
interface Order {
  id: string;
  createdAt: string;
  status: string;
  invoiceNo: string | null;
  amountPaise: number;
  phone: string | null;
  lang: string | null;
  name: string | null;
  paymentMethod: "razorpay" | "cash" | "card" | "upi" | "other";
  paymentRef: string | null;
}

const METHOD = { razorpay: "Online", cash: "Cash", card: "Card", upi: "UPI", other: "Other" };

// Owner only (FR-20). shortcut: English-only labels for the tenant admin; translate with the rest of FR-19.
export default async function AdminPage() {
  const settings = await apiJson<Settings>("/api/tenant/settings");
  if (settings.status === 401) redirect("/login");
  if (settings.status !== 200) notFound();
  const [tenant, revenue, orders, customers, me] = await Promise.all([
    apiJson<PublicTenant>("/api/tenant"),
    apiJson<Month[]>("/api/tenant/revenue"),
    apiJson<Order[]>("/api/tenant/orders"),
    apiJson<unknown[]>("/api/tenant/customers"),
    getMe(),
  ]);
  const [prints, wallet] = await Promise.all([
    apiJson<PrintOrder[]>("/api/tenant/fulfilment"),
    apiJson<WalletData>("/api/tenant/wallet"),
  ]);
  const s = settings.data;
  const rs = (p: number) => inr(p, "en");
  const thisMonth = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
  const m = revenue.data.find((r) => r.month === thisMonth);
  const chip = (status: string) =>
    status === "paid" ? "chip chip-ok" : status === "created" ? "chip chip-warn" : "chip";

  return (
    <Shell tenant={tenant.data} me={me} active="admin">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <main className="page-main">
        <div className="container stack" style={{ gap: 28 }}>
          <div className="page-head">
            <div>
              <h1>Sales</h1>
              <p className="muted" style={{ margin: 0 }}>
                {s.paymentsReady
                  ? `Payments are on. Platform commission ${s.commissionBps / 100}% per sale; the rest goes to your Razorpay account.`
                  : "Payments aren't set up yet: the platform team is still linking your Razorpay account."}
              </p>
            </div>
            <a className="btn btn-ghost" href="/api/tenant/orders.csv">
              <Download /> Download CSV
            </a>
          </div>

          <div className="grid grid-4">
            <div className="stat accent">
              <div className="label">Sales this month</div>
              <div className="value">{rs(m?.grossPaise ?? 0)}</div>
            </div>
            <div className="stat">
              <div className="label">Your share this month</div>
              <div className="value">{rs(m?.yourSharePaise ?? 0)}</div>
            </div>
            <div className="stat">
              <div className="label">Paid orders this month</div>
              <div className="value">{m?.orders ?? 0}</div>
            </div>
            <div className="stat">
              <div className="label">Customers</div>
              <div className="value">{customers.data?.length ?? 0}</div>
            </div>
          </div>

          {wallet.data && <Wallet w={wallet.data} name={tenant.data.name} />}

          <Fulfilment orders={prints.data ?? []} />

          <section className="card">
            <div className="card-head">
              <h2>Revenue by month</h2>
            </div>
            {revenue.data.length === 0 ? (
              <p className="muted">No sales yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="num">Orders</th>
                      <th className="num">Sales</th>
                      <th className="num">GST in sales</th>
                      <th className="num">Commission</th>
                      <th className="num">Your share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.data.map((r) => (
                      <tr key={r.month}>
                        <td>{r.month}</td>
                        <td className="num">{r.orders}</td>
                        <td className="num">{rs(r.grossPaise)}</td>
                        <td className="num">{rs(r.gstPaise)}</td>
                        <td className="num">{rs(r.commissionPaise)}</td>
                        <td className="num">
                          <strong>{rs(r.yourSharePaise)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Recent orders</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Invoice</th>
                    <th className="num">Amount</th>
                    <th>Paid by</th>
                    <th>Kundli of</th>
                    <th>Customer</th>
                    <th>Language</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.slice(0, 50).map((o) => (
                    <tr key={o.id}>
                      <td>{o.createdAt.slice(0, 10)}</td>
                      <td>
                        <span className={chip(o.status)}>{o.status}</span>
                      </td>
                      <td>{o.invoiceNo ? <a href={`/invoice/${o.id}`}>{o.invoiceNo}</a> : "–"}</td>
                      <td className="num">{rs(o.amountPaise)}</td>
                      <td>
                        {METHOD[o.paymentMethod]}
                        {o.paymentRef && <div className="muted small">{o.paymentRef}</div>}
                      </td>
                      <td>{o.name ?? "–"}</td>
                      <td>{o.phone ?? "deleted"}</td>
                      <td>{o.lang ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
            <BrandingSettings initial={s} />
            <AdminSettings
              shopEnabled={s.shopEnabled}
              consultEnabled={s.consultEnabled}
              pricePaise={s.kundliPricePaise}
              printPricePaise={s.printPricePaise}
              gstin={s.gstin}
              legalName={s.legalName}
              address={s.address}
            />
          </div>
        </div>
      </main>
    </Shell>
  );
}
