"use client";

import { useEffect, useRef, useState } from "react";
import { send } from "@/lib/client";
import { inr } from "@/lib/i18n";

const METHODS = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["other", "Other"],
] as const;

/**
 * Staff record an offline sale (cash, UPI, card at the counter): a paid order with an invoice, and
 * the kundli unlocks. Shown in Sales and on the invoice as the method used.
 */
export function RecordPayment({
  reportId,
  name,
  pdfPaise,
  printPaise,
  onClose,
  onDone,
}: {
  reportId: string;
  name: string;
  pdfPaise: number;
  printPaise: number;
  onClose: () => void;
  onDone: (invoiceNo: string, orderId: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<"pdf" | "print">("pdf");
  const [rupees, setRupees] = useState(pdfPaise / 100);
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>("cash");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reference = String(new FormData(e.currentTarget).get("reference") ?? "").trim();
    setBusy(true);
    const r = await send(`/api/reports/${reportId}/offline-payment`, {
      kind,
      amountPaise: Math.round(rupees * 100),
      method,
      reference,
    });
    setBusy(false);
    if (!r.ok) return setMsg(r.data?.error ?? "Could not save the payment.");
    onDone(r.data.invoiceNo, r.data.orderId);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} className="buy-dialog" onClose={onClose} aria-labelledby="rp-title">
      <form className="stack" onSubmit={save}>
        <div className="card-head">
          <div>
            <h2 id="rp-title">Record payment</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {name} · paid at your counter
            </p>
          </div>
          <button type="button" className="btn-link" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>

        <fieldset className="stack" style={{ gap: 8 }}>
          <legend>For</legend>
          {(
            [
              ["pdf", "Kundli (PDF)", pdfPaise],
              ["print", "Printed copy", printPaise],
            ] as const
          ).map(([k, label, p]) => (
            <label className="check" key={k}>
              <input
                type="radio"
                name="kind"
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  setRupees(p / 100);
                }}
              />
              <span>
                {label} <span className="muted small">· {inr(p, "en")}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="form-grid">
          <label>
            Amount received (₹)
            <input
              type="number"
              min={1}
              step={1}
              required
              value={rupees}
              onChange={(e) => setRupees(Number(e.target.value))}
            />
          </label>
          <label>
            Reference (optional)
            <input
              name="reference"
              maxLength={40}
              pattern="[A-Za-z0-9][A-Za-z0-9 ./_\-]{0,39}"
              title="Letters, digits, space . / _ - only"
              placeholder={method === "cash" ? "Receipt no." : "UPI ref / card slip no."}
            />
          </label>
        </div>

        <fieldset className="row" style={{ gap: 8 }}>
          <legend>Paid by</legend>
          {METHODS.map(([m, label]) => (
            <button
              key={m}
              type="button"
              className={`btn btn-sm ${method === m ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
            >
              {label}
            </button>
          ))}
        </fieldset>

        {msg && (
          <p className="notice notice-error" role="alert">
            {msg}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
          Mark paid · {inr(Math.round(rupees * 100), "en")}
        </button>
      </form>
    </dialog>
  );
}
