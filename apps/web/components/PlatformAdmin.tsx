"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { send } from "@/lib/client";
import { inr } from "@/lib/i18n";
import { Bolt, Chart, Globe, Plus, Scroll, Wallet } from "./Icons";

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  plan: string;
  commissionBps: number;
  razorpayAccountId: string | null;
  kundliPricePaise: number;
  printPricePaise: number;
  shopEnabled: boolean;
  consultEnabled: boolean;
  createdAt: string;
  ownerPhone: string | null;
  paidOrders: number;
  salesPaise: number;
  reports: number;
  walletPaise: number;
  reportFeePaise: number | null; // this tenant's override; null = platform fee
  effectiveFeePaise: number;
  feesPaise: number;
}

export interface Application {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
  city: string;
  preferredSlug: string | null;
  message: string | null;
  wantsShop: boolean;
  wantsConsult: boolean;
  pdfPricePaise: number;
  printPricePaise: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const rupees = (p: number) => inr(p, "en");
const paise = (v: FormDataEntryValue | null) => Math.round(Number(v) * 100);
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(path: string, body: unknown, method: string, done: string) {
    const r = await send(path, body, method);
    setMsg({ ok: r.ok, text: r.ok ? done : (r.data?.error ?? "Something went wrong.") });
    if (r.ok) router.refresh();
    return r.ok;
  }
  return { msg, run };
}

const Notice = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg && (
    <p className={`notice${msg.ok ? "" : " notice-error"}`} role="status">
      {msg.text}
    </p>
  );

const Features = ({ shop, consult }: { shop: boolean; consult: boolean }) => (
  <>
    {shop && <span className="chip chip-plain">Shop</span>}
    {consult && <span className="chip chip-plain">Consultation</span>}
    {!shop && !consult && <span className="muted small">Kundli only</span>}
  </>
);

/** OTP login for platform owners (phones added with `bun run platform:add-admin`). */
export function PlatformLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("+91");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await send("/api/admin/otp", { phone: phone.replace(/[\s-]/g, "") });
    setBusy(false);
    if (!r.ok) return setMsg(r.data?.error ?? "Could not send the code.");
    setDevCode(r.data?.devCode ?? null);
    setStep("code");
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    setBusy(true);
    const r = await send("/api/admin/verify", { phone: phone.replace(/[\s-]/g, ""), code });
    setBusy(false);
    if (r.ok) router.refresh();
    else setMsg(r.data?.error ?? "Could not log in.");
  }

  return step === "phone" ? (
    <form className="card stack" onSubmit={sendCode}>
      <h1 style={{ fontSize: "1.8rem" }}>Platform admin</h1>
      <label>
        Mobile number
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      {msg && (
        <p className="notice notice-error" role="alert">
          {msg}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        Send code
      </button>
    </form>
  ) : (
    <form className="card stack" onSubmit={verify}>
      <h1 style={{ fontSize: "1.8rem" }}>Enter the code</h1>
      <p className="muted" style={{ margin: 0 }}>
        If {phone} is a platform admin, a 6-digit code was sent to it.
      </p>
      {devCode && (
        <p className="notice" role="status">
          No SMS provider yet (development): your code is <strong>{devCode}</strong>
        </p>
      )}
      <label>
        Code
        <input
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
        />
      </label>
      {msg && (
        <p className="notice notice-error" role="alert">
          {msg}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        Log in
      </button>
      <div className="row">
        <button type="button" className="btn-link" onClick={() => sendCode()}>
          Send a new code
        </button>
        <button type="button" className="btn-link" onClick={() => setStep("phone")}>
          Change number
        </button>
      </div>
    </form>
  );
}

export function PlatformLogout() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="nav-link"
      onClick={async () => {
        await send("/api/admin/logout");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}

function ApplicationRow({ a }: { a: Application }) {
  const { msg, run } = useAction();
  return (
    <div className="app-row">
      <div>
        <strong>{a.businessName}</strong>{" "}
        <span className="muted small">
          {a.contactName} · {a.city} · {new Date(a.createdAt).toLocaleDateString("en-IN")}
        </span>
        <div className="meta" style={{ marginTop: 6 }}>
          <a href={`tel:${a.phone}`}>{a.phone}</a>
          {a.email && <a href={`mailto:${a.email}`}>{a.email}</a>}
          <span>PDF {rupees(a.pdfPricePaise)}</span>
          <span>Print {rupees(a.printPricePaise)}</span>
          <Features shop={a.wantsShop} consult={a.wantsConsult} />
        </div>
        {a.message && (
          <p className="muted small" style={{ margin: "8px 0 0" }}>
            “{a.message}”
          </p>
        )}
        <Notice msg={msg} />
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const slug = String(new FormData(e.currentTarget).get("slug") ?? "").trim();
          run(`/api/admin/applications/${a.id}/approve`, { slug }, "POST", `Approved: ${slug}`);
        }}
      >
        <input
          name="slug"
          aria-label="Site name (subdomain)"
          required
          defaultValue={a.preferredSlug ?? slugify(a.businessName)}
          style={{ width: 180 }}
        />
        <button type="submit" className="btn btn-primary btn-sm">
          Approve
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (confirm(`Reject ${a.businessName}?`))
              run(`/api/admin/applications/${a.id}/reject`, undefined, "POST", "Rejected.");
          }}
        >
          Reject
        </button>
      </form>
    </div>
  );
}

function AddTenant({ onDone }: { onDone: () => void }) {
  const { msg, run } = useAction();
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (k: string) => String(f.get(k) ?? "").trim();
        const ok = await run(
          "/api/admin/tenants",
          {
            slug: v("slug").toLowerCase(),
            name: v("name"),
            ownerPhone: v("phone").replace(/[\s-]/g, ""),
            kundliPricePaise: paise(f.get("pdf")),
            printPricePaise: paise(f.get("print")),
            shopEnabled: f.get("shop") === "on",
            consultEnabled: f.get("consult") === "on",
          },
          "POST",
          "Tenant created.",
        );
        if (ok) onDone();
      }}
    >
      <h2>Add a tenant directly</h2>
      <div className="form-grid">
        <label>
          Business name
          <input name="name" required maxLength={100} />
        </label>
        <label>
          Site name (subdomain)
          <input
            name="slug"
            required
            maxLength={30}
            pattern="[a-zA-Z0-9][a-zA-Z0-9\-]{1,28}[a-zA-Z0-9]"
          />
        </label>
        <label>
          Owner mobile
          <input name="phone" type="tel" required defaultValue="+91" />
        </label>
        <span />
        <label>
          PDF price (₹)
          <input name="pdf" type="number" min={0} required defaultValue={99} />
        </label>
        <label>
          Printed copy price (₹)
          <input name="print" type="number" min={0} required defaultValue={500} />
        </label>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" name="shop" /> <span>Shop</span>
        </label>
        <label className="check">
          <input type="checkbox" name="consult" /> <span>Online consultation</span>
        </label>
      </div>
      <Notice msg={msg} />
      <button type="submit" className="btn btn-primary">
        Create tenant
      </button>
    </form>
  );
}

/** Add wallet credit after the tenant pays us; a negative amount corrects a mistake. */
function Recharge({ t }: { t: TenantRow }) {
  const { msg, run } = useAction();
  return (
    <form
      className="stack"
      style={{ gap: 8, marginBottom: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const amountPaise = paise(f.get("amount"));
        const note = String(f.get("note") ?? "").trim() || null;
        const ok = await run(
          `/api/admin/tenants/${t.slug}/credit`,
          { amountPaise, note },
          "POST",
          `${amountPaise > 0 ? "Added" : "Removed"} ${rupees(Math.abs(amountPaise))}.`,
        );
        if (ok) form.reset();
      }}
    >
      <div className="row">
        <span>
          Wallet <strong>{rupees(t.walletPaise)}</strong>
        </span>
        <input
          name="amount"
          type="number"
          step={1}
          required
          placeholder="₹ amount"
          aria-label="Credit to add in rupees (negative to correct)"
          style={{ width: 130 }}
        />
        <input
          name="note"
          maxLength={200}
          placeholder="Note, e.g. UPI ref (tenant sees it)"
          aria-label="Note"
          style={{ width: 280 }}
        />
        <button type="submit" className="btn btn-primary btn-sm">
          Add credit
        </button>
      </div>
      <Notice msg={msg} />
    </form>
  );
}

function EditTenant({ t, onClose }: { t: TenantRow; onClose: () => void }) {
  const { msg, run } = useAction();
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (k: string) => String(f.get(k) ?? "").trim();
        const ok = await run(
          `/api/admin/tenants/${t.slug}`,
          {
            name: v("name"),
            commissionBps: Math.round(Number(v("commission")) * 100),
            razorpayAccountId: v("acc") || null,
            domain: v("domain").toLowerCase() || null,
            kundliPricePaise: paise(f.get("pdf")),
            printPricePaise: paise(f.get("print")),
            shopEnabled: f.get("shop") === "on",
            consultEnabled: f.get("consult") === "on",
            // Empty = follow the platform fee.
            reportFeePaise: v("fee") === "" ? null : paise(f.get("fee")),
          },
          "PATCH",
          "Saved.",
        );
        if (ok) onClose();
      }}
    >
      <div className="form-grid">
        <label>
          Business name
          <input name="name" required defaultValue={t.name} />
        </label>
        <label>
          Our commission (%)
          <input
            name="commission"
            type="number"
            min={0}
            max={100}
            step={0.01}
            required
            defaultValue={t.commissionBps / 100}
          />
        </label>
        <label>
          Razorpay linked account
          <input name="acc" placeholder="acc_..." defaultValue={t.razorpayAccountId ?? ""} />
        </label>
        <label>
          Custom domain (optional)
          <input name="domain" placeholder="www.example.com" defaultValue={t.domain ?? ""} />
        </label>
        <label>
          PDF price (₹)
          <input
            name="pdf"
            type="number"
            min={0}
            required
            defaultValue={t.kundliPricePaise / 100}
          />
        </label>
        <label>
          Printed copy price (₹)
          <input
            name="print"
            type="number"
            min={0}
            required
            defaultValue={t.printPricePaise / 100}
          />
        </label>
        <label>
          Special kundli fee for this tenant (₹, empty = platform fee)
          <input
            name="fee"
            type="number"
            min={0}
            step={0.01}
            placeholder={`Platform fee: ${rupees(t.effectiveFeePaise)}`}
            defaultValue={t.reportFeePaise === null ? "" : t.reportFeePaise / 100}
          />
        </label>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" name="shop" defaultChecked={t.shopEnabled} /> <span>Shop</span>
        </label>
        <label className="check">
          <input type="checkbox" name="consult" defaultChecked={t.consultEnabled} />{" "}
          <span>Online consultation</span>
        </label>
      </div>
      <Notice msg={msg} />
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm">
          Save
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Platform-wide kundli fee: what each kundli costs a tenant's wallet (unless overridden). */
function FeeSetting({ feePaise }: { feePaise: number }) {
  const { msg, run } = useAction();
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(
          "/api/admin/settings",
          { reportFeePaise: paise(f.get("fee")) },
          "PATCH",
          "Kundli fee saved.",
        );
      }}
    >
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>Kundli fee</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Taken from a tenant's wallet for every kundli created on their site. Tenants with a
            special fee keep theirs.
          </p>
        </div>
        <div className="row">
          <input
            name="fee"
            type="number"
            min={0}
            step={0.01}
            required
            defaultValue={feePaise / 100}
            aria-label="Kundli fee in rupees"
            style={{ width: 120 }}
          />
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </div>
      <Notice msg={msg} />
    </form>
  );
}

type View = "overview" | "applications" | "tenants" | "settings";
type Filter = "all" | "blocked" | "unlinked" | "selling";
const PAGE = 25;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase())
    .join("");

/** Tenant settings and wallet top-up in a dialog, instead of expanding a table row. */
function ManageTenant({ t, onClose }: { t: TenantRow; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="adm-dialog" onClose={onClose} aria-labelledby="mt-title">
      <div className="card-head">
        <div className="adm-who">
          <span className="adm-avatar">{initials(t.name)}</span>
          <div>
            <h2 id="mt-title">{t.name}</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {t.domain ?? t.slug} · owner {t.ownerPhone ?? "—"}
            </p>
          </div>
        </div>
        <button type="button" className="btn-link" onClick={() => ref.current?.close()}>
          Close
        </button>
      </div>
      <h3 className="adm-sub">Wallet</h3>
      <Recharge t={t} />
      <h3 className="adm-sub">Settings</h3>
      <EditTenant t={t} onClose={() => ref.current?.close()} />
    </dialog>
  );
}

const NAV: [View, string, typeof Chart][] = [
  ["overview", "Overview", Chart],
  ["applications", "Applications", Scroll],
  ["tenants", "Tenants", Globe],
  ["settings", "Settings", Wallet],
];

export function PlatformAdmin({
  tenants,
  apps,
  siteBase,
  feePaise,
  adminPhone,
}: {
  tenants: TenantRow[];
  apps: Application[];
  siteBase: string;
  feePaise: number;
  adminPhone: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [adding, setAdding] = useState(false);
  // An id, not the row: after a top-up the refreshed list feeds the open dialog new numbers.
  const [managingId, setManagingId] = useState<string | null>(null);
  const managing = tenants.find((t) => t.id === managingId) ?? null;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  // Remember the section across reloads (router.refresh after an action keeps state anyway).
  useEffect(() => {
    const h = location.hash.slice(1) as View;
    if (NAV.some(([v]) => v === h)) setView(h);
  }, []);
  const go = (v: View) => {
    setView(v);
    history.replaceState(null, "", `#${v}`);
    window.scrollTo({ top: 0 });
  };

  const pending = apps.filter((a) => a.status === "pending");
  const decided = apps.filter((a) => a.status !== "pending").slice(0, 10);
  const sales = tenants.reduce((s, t) => s + t.salesPaise, 0);
  const orders = tenants.reduce((s, t) => s + t.paidOrders, 0);
  const fees = tenants.reduce((s, t) => s + t.feesPaise, 0);
  const blocked = tenants.filter((t) => t.walletPaise < t.effectiveFeePaise);
  const unlinked = tenants.filter((t) => !t.razorpayAccountId);
  const selling = tenants.filter((t) => t.paidOrders > 0);
  const top = [...tenants].sort((a, b) => b.salesPaise - a.salesPaise).slice(0, 5);
  const topMax = Math.max(1, ...top.map((t) => t.salesPaise));
  const site = (t: TenantRow) =>
    t.domain ? `https://${t.domain}` : siteBase.replace("{slug}", t.slug);

  const needle = q.trim().toLowerCase();
  const base = { all: tenants, blocked, unlinked, selling }[filter];
  const shown = needle
    ? base.filter((t) =>
        [t.name, t.slug, t.domain, t.ownerPhone].some((v) => v?.toLowerCase().includes(needle)),
      )
    : base;
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const slice = shown.slice(page * PAGE, page * PAGE + PAGE);

  const TITLES: Record<View, [string, string]> = {
    overview: ["Overview", "How the platform is doing today."],
    applications: ["Applications", "Astrologers who applied from the website."],
    tenants: ["Tenants", "Every astrologer site: wallet, payments, prices and features."],
    settings: ["Settings", "Platform-wide prices and fees."],
  };

  const TenantName = ({ t }: { t: TenantRow }) => (
    <div className="adm-who">
      <span className="adm-avatar">{initials(t.name)}</span>
      <div>
        <strong>{t.name}</strong>
        <div className="small">
          <a href={site(t)} target="_blank" rel="noreferrer">
            {t.domain ?? t.slug}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="adm">
      <aside className="adm-side">
        <a className="adm-brand" href="/">
          <img src="/brand/nakshtraya-mark.png" alt="" width={40} height={40} />
          <span>
            Nakshtraya
            <small>Platform admin</small>
          </span>
        </a>
        <nav aria-label="Admin">
          {NAV.map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              className="adm-nav"
              aria-current={view === v ? "page" : undefined}
              onClick={() => go(v)}
            >
              <Icon />
              <span>{label}</span>
              {v === "applications" && pending.length > 0 && (
                <span className="adm-count">{pending.length}</span>
              )}
              {v === "tenants" && <span className="adm-count muted-count">{tenants.length}</span>}
            </button>
          ))}
        </nav>
        <div className="adm-me">
          <span className="small">{adminPhone}</span>
          <button
            type="button"
            className="btn-link"
            onClick={async () => {
              await send("/api/admin/logout");
              router.refresh();
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <header className="adm-top">
          <div>
            <h1>{TITLES[view][0]}</h1>
            <p className="muted">{TITLES[view][1]}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
            <Plus /> Add tenant
          </button>
        </header>

        {adding && <AddTenant onDone={() => setAdding(false)} />}
        {managing && <ManageTenant t={managing} onClose={() => setManagingId(null)} />}

        {view === "overview" && (
          <div className="stack" style={{ gap: 20 }}>
            <div className="adm-kpis">
              <div className="adm-kpi featured">
                <span className="adm-kpi-icon">
                  <Wallet />
                </span>
                <div className="label">Kundli fees earned</div>
                <div className="value">{rupees(fees)}</div>
                <div className="hint">Platform income from tenant wallets</div>
              </div>
              <div className="adm-kpi">
                <span className="adm-kpi-icon">
                  <Bolt />
                </span>
                <div className="label">Sales, all tenants</div>
                <div className="value">{rupees(sales)}</div>
                <div className="hint">{orders} paid orders</div>
              </div>
              <div className="adm-kpi">
                <span className="adm-kpi-icon">
                  <Globe />
                </span>
                <div className="label">Tenants</div>
                <div className="value">{tenants.length}</div>
                <div className="hint">{selling.length} have made a sale</div>
              </div>
              <button type="button" className="adm-kpi link" onClick={() => go("applications")}>
                <span className="adm-kpi-icon">
                  <Scroll />
                </span>
                <div className="label">Pending applications</div>
                <div className="value">{pending.length}</div>
                <div className="hint">{pending.length ? "Review now →" : "All caught up"}</div>
              </button>
            </div>

            <div className="adm-cols">
              <section className="card">
                <div className="card-head">
                  <h2>Needs attention</h2>
                </div>
                <ul className="adm-todo">
                  <li>
                    <span className={`dot ${pending.length ? "warn" : "ok"}`} />
                    <span>
                      <strong>{pending.length}</strong> application{pending.length === 1 ? "" : "s"}{" "}
                      waiting for a call
                    </span>
                    <button type="button" className="btn-link" onClick={() => go("applications")}>
                      Review
                    </button>
                  </li>
                  <li>
                    <span className={`dot ${blocked.length ? "warn" : "ok"}`} />
                    <span>
                      <strong>{blocked.length}</strong> tenant{blocked.length === 1 ? "" : "s"}{" "}
                      can&apos;t create kundlis (wallet too low)
                    </span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setFilter("blocked");
                        setPage(0);
                        go("tenants");
                      }}
                    >
                      See
                    </button>
                  </li>
                  <li>
                    <span className={`dot ${unlinked.length ? "warn" : "ok"}`} />
                    <span>
                      <strong>{unlinked.length}</strong> without Razorpay linked (can&apos;t take
                      online payments)
                    </span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setFilter("unlinked");
                        setPage(0);
                        go("tenants");
                      }}
                    >
                      See
                    </button>
                  </li>
                </ul>
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Top tenants by sales</h2>
                </div>
                {top.every((t) => t.salesPaise === 0) ? (
                  <p className="muted">No sales yet.</p>
                ) : (
                  <ul className="adm-bars">
                    {top.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => setManagingId(t.id)}
                        >
                          {t.name}
                        </button>
                        <span className="num">{rupees(t.salesPaise)}</span>
                        <span className="bar">
                          <span style={{ width: `${(t.salesPaise / topMax) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {pending.length > 0 && (
              <section className="card">
                <div className="card-head">
                  <h2>Latest applications</h2>
                  <button type="button" className="btn-link" onClick={() => go("applications")}>
                    All applications
                  </button>
                </div>
                {pending.slice(0, 3).map((a) => (
                  <ApplicationRow key={a.id} a={a} />
                ))}
              </section>
            )}
          </div>
        )}

        {view === "applications" && (
          <section className="card">
            <div className="card-head">
              <h2>Waiting for review</h2>
              <span className={`chip ${pending.length ? "chip-warn" : "chip-ok"}`}>
                {pending.length} waiting
              </span>
            </div>
            {pending.length === 0 ? (
              <p className="muted">No new applications.</p>
            ) : (
              pending.map((a) => <ApplicationRow key={a.id} a={a} />)
            )}
            {decided.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="muted small">Recently decided</summary>
                <ul className="list">
                  {decided.map((a) => (
                    <li key={a.id}>
                      <span>
                        {a.businessName} <span className="muted small">· {a.phone}</span>
                      </span>
                      <span className={`chip ${a.status === "approved" ? "chip-ok" : "chip-warn"}`}>
                        {a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {view === "tenants" && (
          <section className="card adm-table-card">
            <div className="adm-filters">
              <fieldset className="segmented">
                <legend className="sr-only">Filter tenants</legend>
                {(
                  [
                    ["all", "All", tenants.length],
                    ["selling", "Selling", selling.length],
                    ["blocked", "Wallet low", blocked.length],
                    ["unlinked", "No Razorpay", unlinked.length],
                  ] as const
                ).map(([f, label, n]) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => {
                      setFilter(f);
                      setPage(0);
                    }}
                  >
                    {label} <span className="muted">{n}</span>
                  </button>
                ))}
              </fieldset>
              <input
                type="search"
                placeholder="Search name, site or phone"
                aria-label="Search tenants"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Owner</th>
                    <th>Prices</th>
                    <th>Wallet</th>
                    <th>Payments</th>
                    <th className="num">Sales</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {slice.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <TenantName t={t} />
                      </td>
                      <td className="small">{t.ownerPhone ?? "—"}</td>
                      <td className="small">
                        PDF {rupees(t.kundliPricePaise)}
                        <br />
                        <span className="muted">Print {rupees(t.printPricePaise)}</span>
                      </td>
                      <td>
                        <strong className="small">{rupees(t.walletPaise)}</strong>
                        <div>
                          {t.walletPaise < t.effectiveFeePaise ? (
                            <span className="chip chip-warn">Blocked</span>
                          ) : (
                            <span className="muted small">
                              {Math.floor(t.walletPaise / Math.max(1, t.effectiveFeePaise))} kundlis
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="small">
                        {t.razorpayAccountId ? (
                          <span className="chip chip-ok">Linked</span>
                        ) : (
                          <span className="chip chip-warn">Not linked</span>
                        )}
                        <div className="muted">{t.commissionBps / 100}% commission</div>
                      </td>
                      <td className="num">
                        <strong>{rupees(t.salesPaise)}</strong>
                        <div className="muted small">
                          {t.paidOrders} orders · {t.reports} kundlis
                        </div>
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setManagingId(t.id)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {slice.length === 0 && (
                    <tr>
                      <td colSpan={7} className="muted">
                        No tenants match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="adm-pager">
              <span className="muted small">
                {shown.length === 0
                  ? "0"
                  : `${page * PAGE + 1}–${Math.min(shown.length, page * PAGE + PAGE)}`}{" "}
                of {shown.length}
              </span>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {view === "settings" && <FeeSetting feePaise={feePaise} />}
      </main>
    </div>
  );
}
