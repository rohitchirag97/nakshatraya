"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { send } from "@/lib/client";
import { inr, langName, locale, tr } from "@/lib/i18n";
import { BuyDialog, type Ship } from "./BuyDialog";
import { Download, Plus, Scroll, Sparkle } from "./Icons";
import { RecordPayment } from "./RecordPayment";

export interface Person {
  id: string;
  name: string;
  birthLocal: string;
  timeKnown: boolean;
}
export interface ReportRow {
  id: string;
  status: "ready" | "locked";
  lang: string;
  name: string;
  createdAt: string;
}
export interface OrderRow {
  id: string;
  status: string;
  kind: "pdf" | "print";
  amountPaise: number;
  invoiceNo: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  trackingNo: string | null;
}
interface Place {
  id: number;
  name: string;
  admin1: string | null;
  country: string;
}

declare global {
  interface Window {
    Razorpay?: new (
      opts: Record<string, unknown>,
    ) => { open(): void; on(ev: string, fn: () => void): void };
  }
}

interface Props {
  lang: string;
  tenant: {
    name: string;
    brandColor: string;
    enabledLangs: string[];
    kundliPricePaise: number;
    printPricePaise: number;
  };
  people: Person[];
  reports: ReportRow[];
  orders: OrderRow[];
  /** Owner or astrologer: prints kundlis themselves instead of ordering a printed copy. */
  staff?: boolean;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase())
    .join("");

export function Dashboard({ lang, tenant, people, reports, orders, staff = false }: Props) {
  const t = tr(lang);
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Open buy dialog: which report, and whether the PDF option applies (not once it's unlocked).
  const [buying, setBuying] = useState<{ reportId: string; allowPdf: boolean } | null>(null);
  // Staff: record an offline (cash / UPI / card) payment for this kundli.
  const [recording, setRecording] = useState<{ reportId: string; name: string } | null>(null);
  const [reportLang, setReportLang] = useState(
    tenant.enabledLangs.includes(lang) ? lang : tenant.enabledLangs[0]!,
  );
  const price = inr(tenant.kundliPricePaise, lang);
  const day = (iso: string, utc = false) =>
    new Intl.DateTimeFormat(locale(lang), {
      dateStyle: "medium",
      ...(utc ? { timeZone: "UTC" } : {}),
    }).format(new Date(iso));

  async function pay(reportId: string, kind: "pdf" | "print", ship?: Ship) {
    setBuying(null);
    setMsg(t("ui.paying"));
    const o = await send(`/api/reports/${reportId}/order`, { kind, ship });
    if (!o.ok) return setMsg(o.data?.error ?? t("ui.error"));
    // Local test mode (API decides; never in production): no gateway, mark paid and open the report.
    if (o.data.fake) {
      if (!confirm(`TEST MODE: no real payment.\nMark ${inr(o.data.amount, lang)} as paid?`))
        return setMsg("");
      const v = await send("/api/orders/fake-pay", { razorpayOrderId: o.data.razorpayOrderId });
      if (!v.ok) return setMsg(v.data?.error ?? t("ui.error"));
      setMsg(t("ui.paid"));
      router.push(`/report/${reportId}`);
      router.refresh();
      return;
    }
    if (!window.Razorpay) return setMsg(t("ui.error"));
    const rz = new window.Razorpay({
      key: o.data.keyId,
      amount: o.data.amount,
      currency: o.data.currency,
      order_id: o.data.razorpayOrderId,
      name: tenant.name,
      description: t("title"),
      theme: { color: tenant.brandColor },
      handler: async (resp: Record<string, string>) => {
        setMsg(t("ui.paid"));
        const v = await send("/api/orders/verify", resp);
        // If the callback check fails, the webhook still unlocks the report shortly after.
        router.push(v.ok ? `/report/${reportId}` : "/app");
        router.refresh();
      },
      modal: { ondismiss: () => setMsg("") },
    });
    rz.on("payment.failed", () => setMsg(t("ui.payFailed")));
    rz.open();
  }

  async function getKundli(profileId: string) {
    setMsg("");
    setBusy(profileId);
    try {
      const r = await send("/api/reports", { profileId, lang: reportLang });
      // Wallet empty: staff get the server's "recharge" message, customers a translated one.
      if (r.data?.code === "wallet_empty" && !r.data.staff)
        return setMsg(t("ui.unavailable", { name: tenant.name }));
      if (!r.ok) return setMsg(r.data?.error ?? t("ui.error"));
      if (r.data.status === "ready") router.push(`/report/${r.data.id}`);
      else setBuying({ reportId: r.data.id, allowPdf: true });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    if (!confirm(t("ui.deleteAccount"))) return;
    const r = await send("/api/me", undefined, "DELETE");
    if (r.status === 204 || r.ok) router.push("/");
    else setMsg(r.data?.error ?? t("ui.error"));
  }

  const paid = orders.filter((o) => o.status === "paid");

  return (
    <div className="stack" style={{ gap: 32 }}>
      {buying && (
        <BuyDialog
          lang={lang}
          pdfPaise={tenant.kundliPricePaise}
          printPaise={tenant.printPricePaise}
          allowPdf={buying.allowPdf}
          onPay={(kind, ship) => pay(buying.reportId, kind, ship)}
          onClose={() => setBuying(null)}
        />
      )}
      {recording && (
        <RecordPayment
          reportId={recording.reportId}
          name={recording.name}
          pdfPaise={tenant.kundliPricePaise}
          printPaise={tenant.printPricePaise}
          onClose={() => setRecording(null)}
          onDone={(invoiceNo) => {
            setMsg(`Payment recorded. Invoice ${invoiceNo}.`);
            router.refresh();
          }}
        />
      )}
      {msg && (
        <p className="notice" role="status">
          {msg}
        </p>
      )}

      <section>
        <div className="card-head">
          <h2>{t("ui.people")}</h2>
          {tenant.enabledLangs.length > 1 && (
            <fieldset className="segmented">
              <legend className="sr-only">{t("ui.language")}</legend>
              {tenant.enabledLangs.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={reportLang === l}
                  onClick={() => setReportLang(l)}
                >
                  {langName(l)}
                </button>
              ))}
            </fieldset>
          )}
        </div>
        {people.length === 0 && <p className="muted">{t("ui.noPeople")}</p>}
        <div className="grid grid-3">
          {people.map((p) => (
            <div className="card person" key={p.id}>
              <div className="person-top">
                <span className="avatar" aria-hidden="true">
                  {initials(p.name)}
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {day(`${p.birthLocal.slice(0, 10)}T00:00:00Z`, true)}
                    {p.timeKnown ? ` · ${p.birthLocal.slice(11, 16)}` : ""}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy === p.id}
                onClick={() => getKundli(p.id)}
              >
                <Sparkle /> {t("ui.buy")}
                {tenant.kundliPricePaise ? ` · ${price}` : ""}
              </button>
            </div>
          ))}
          <AddPerson lang={lang} onAdded={() => router.refresh()} />
        </div>
      </section>

      {reports.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>{t("ui.reports")}</h2>
          </div>
          <ul className="list">
            {reports.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <div className="meta">
                    <span className={`chip ${r.status === "ready" ? "chip-ok" : "chip-warn"}`}>
                      {r.status === "ready" ? t("ui.ready") : t("ui.locked")}
                    </span>
                    <span className="chip chip-plain">{langName(r.lang)}</span>
                    <span>{day(r.createdAt)}</span>
                  </div>
                </div>
                {r.status === "ready" ? (
                  <div className="row">
                    {staff ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setRecording({ reportId: r.id, name: r.name })}
                        >
                          {t("ui.recordPayment")}
                        </button>
                        <a className="btn btn-ghost btn-sm" href={`/print/${r.id}`}>
                          {t("ui.print")}
                        </a>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setBuying({ reportId: r.id, allowPdf: false })}
                      >
                        {t("buy.orderPrint")}
                      </button>
                    )}
                    <a className="btn btn-primary" href={`/report/${r.id}`}>
                      <Scroll /> {t("ui.open")}
                    </a>
                  </div>
                ) : staff ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setRecording({ reportId: r.id, name: r.name })}
                  >
                    {t("ui.recordPayment")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setBuying({ reportId: r.id, allowPdf: true })}
                  >
                    {t("ui.pay", { price })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {paid.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>{t("ui.orders")}</h2>
          </div>
          <ul className="list">
            {paid.map((o) => (
              <li key={o.id}>
                <div>
                  <strong>{inr(o.amountPaise, lang)}</strong>
                  <div className="meta">
                    <span className="chip chip-plain">
                      {o.kind === "print" ? t("orders.print") : t("orders.pdf")}
                    </span>
                    {o.kind === "print" && (
                      <span className={`chip ${o.shippedAt ? "chip-ok" : "chip-warn"}`}>
                        {o.shippedAt ? t("orders.shipped") : t("orders.preparing")}
                      </span>
                    )}
                    {o.trackingNo && (
                      <span>
                        {t("orders.tracking")}: {o.trackingNo}
                      </span>
                    )}
                    <span>{o.invoiceNo}</span>
                    {o.paidAt && <span>{day(o.paidAt)}</span>}
                  </div>
                </div>
                <a className="btn btn-ghost btn-sm" href={`/invoice/${o.id}`}>
                  {t("ui.invoice")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="account-links">
        <a href="/api/me/export">
          <Download className="icon" /> {t("ui.exportData")}
        </a>
        <button type="button" className="btn-link" onClick={deleteAccount}>
          {t("ui.deleteAccount")}
        </button>
      </div>
    </div>
  );
}

function AddPerson({ lang, onAdded }: { lang: string; onAdded: () => void }) {
  const t = tr(lang);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(""); // the query the current results are for

  useEffect(() => {
    if (place || q.trim().length < 2) return setPlaces([]);
    const id = setTimeout(async () => {
      const r = await send(`/api/places?q=${encodeURIComponent(q.trim())}`, undefined, "GET");
      if (r.ok) {
        setPlaces(r.data);
        setSearched(q.trim());
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q, place]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!place) return setError(t("ui.placePick"));
    const r = await send("/api/profiles", {
      name: f.get("name"),
      gender: f.get("gender"),
      date: f.get("date"),
      time: unknown ? null : f.get("time"),
      placeId: place.id,
    });
    if (!r.ok) return setError(r.data?.error ?? t("ui.error"));
    setOpen(false);
    setPlace(null);
    setQ("");
    onAdded();
  }

  if (!open)
    return (
      <button type="button" className="add-card" onClick={() => setOpen(true)}>
        <span className="row">
          <Plus /> {t("ui.addPerson")}
        </span>
      </button>
    );
  return (
    <form className="card" style={{ gridColumn: "1 / -1" }} onSubmit={submit}>
      <div className="card-head">
        <h3>{t("ui.addPerson")}</h3>
      </div>
      <div className="form-grid">
        <label>
          {t("ui.name")}
          <input name="name" required maxLength={100} autoComplete="name" />
        </label>
        <label>
          {t("ui.gender")}
          <select name="gender" required defaultValue="male">
            <option value="male">{t("ui.male")}</option>
            <option value="female">{t("ui.female")}</option>
            <option value="other">{t("ui.other")}</option>
          </select>
        </label>
        <label>
          {t("ui.dob")}
          <input name="date" type="date" required min="1800-01-01" />
        </label>
        <label>
          {t("ui.tob")}
          <input name="time" type="time" required={!unknown} disabled={unknown} />
        </label>
        <label className="check span-2">
          <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} />
          <span>{t("ui.timeUnknown")}</span>
        </label>
        <div className="span-2 stack" style={{ gap: 8 }}>
          <label>
            {t("ui.place")}
            <input
              value={
                place ? [place.name, place.admin1, place.country].filter(Boolean).join(", ") : q
              }
              onChange={(e) => {
                setPlace(null);
                setQ(e.target.value);
              }}
              placeholder={t("ui.placeSearch")}
              autoComplete="off"
              required
            />
          </label>
          {!place && places.length === 0 && searched !== "" && searched === q.trim() && (
            <p className="muted small">{t("ui.placeNoMatch")}</p>
          )}
          {places.length > 0 && (
            <ul className="choices">
              {places.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlace(p);
                      setPlaces([]);
                      setError("");
                    }}
                  >
                    {[p.name, p.admin1, p.country].filter(Boolean).join(", ")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {error && (
        <p className="notice notice-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}
      <div className="row" style={{ marginTop: 18 }}>
        <button type="submit" className="btn btn-primary">
          {t("ui.save")}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          {t("ui.cancel")}
        </button>
      </div>
    </form>
  );
}
