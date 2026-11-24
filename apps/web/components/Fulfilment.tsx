"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client";
import { Download } from "./Icons";

export interface PrintOrder {
  id: string;
  paidAt: string | null;
  invoiceNo: string | null;
  reportId: string | null;
  lang: string | null;
  shipName: string | null;
  shipPhone: string | null;
  shipAddress: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPincode: string | null;
  trackingNo: string | null;
  shippedAt: string | null;
}

/** Printed copies the tenant posts: address, print-ready PDF, mark shipped. */
export function Fulfilment({ orders }: { orders: PrintOrder[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const pending = orders.filter((o) => !o.shippedAt);

  async function ship(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const trackingNo = String(new FormData(e.currentTarget).get("trackingNo") ?? "").trim();
    const r = await send(`/api/tenant/orders/${id}/shipped`, {
      trackingNo: trackingNo || undefined,
    });
    setMsg(r.ok ? "Marked as shipped." : (r.data?.error ?? "Could not update."));
    if (r.ok) router.refresh();
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>To print &amp; post</h2>
        <span className={`chip ${pending.length ? "chip-warn" : "chip-ok"}`}>
          {pending.length} waiting
        </span>
      </div>
      {msg && (
        <p className="notice" role="status">
          {msg}
        </p>
      )}
      {orders.length === 0 ? (
        <p className="muted">No printed-copy orders yet.</p>
      ) : (
        <ul className="list">
          {orders.map((o) => (
            <li key={o.id}>
              <div>
                <strong>{o.shipName ?? "(address removed)"}</strong>
                <div className="muted small">
                  {[o.shipAddress, o.shipCity, o.shipState, o.shipPincode]
                    .filter(Boolean)
                    .join(", ")}
                  {o.shipPhone ? ` · ${o.shipPhone}` : ""}
                </div>
                <div className="meta">
                  <span className={`chip ${o.shippedAt ? "chip-ok" : "chip-warn"}`}>
                    {o.shippedAt ? `Shipped ${o.shippedAt.slice(0, 10)}` : "To post"}
                  </span>
                  {o.trackingNo && <span>Tracking: {o.trackingNo}</span>}
                  {o.invoiceNo && <span>{o.invoiceNo}</span>}
                  {o.lang && <span>{o.lang}</span>}
                </div>
              </div>
              <div className="row">
                {o.reportId && (
                  <a className="btn btn-ghost btn-sm" href={`/print/${o.reportId}`}>
                    <Download /> Print
                  </a>
                )}
                {!o.shippedAt && (
                  <form className="row" onSubmit={(e) => ship(e, o.id)}>
                    <input
                      name="trackingNo"
                      placeholder="Tracking no. (optional)"
                      aria-label="Tracking number"
                      style={{ width: 190 }}
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Mark shipped
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
