import { inr } from "@/lib/i18n";
import { WalletRecharge } from "./WalletRecharge";

export interface WalletData {
  balancePaise: number;
  reportFeePaise: number;
  minTopupPaise: number;
  transactions: {
    id: string;
    amountPaise: number;
    kind: "topup" | "adjustment" | "report_fee";
    note: string | null;
    createdAt: string;
  }[];
}

const LABEL = { topup: "Recharge", adjustment: "Correction", report_fee: "Kundli created" };

/** Owner's platform wallet: each kundli costs the fee; below it, nobody can create one. */
export function Wallet({ w, name }: { w: WalletData; name: string }) {
  const rs = (p: number) => inr(p, "en");
  const left =
    w.reportFeePaise > 0 ? Math.floor(Math.max(w.balancePaise, 0) / w.reportFeePaise) : null;
  const empty = left === 0;
  const low = left !== null && left > 0 && left < 10;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Wallet</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Each kundli created on your site, by a customer or by you, costs {rs(w.reportFeePaise)}{" "}
            from this balance.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="stat-value-lg">{rs(w.balancePaise)}</div>
          {left !== null && (
            <span className={`chip ${empty ? "chip-warn" : low ? "chip-warn" : "chip-ok"}`}>
              {left} kundli{left === 1 ? "" : "s"} left
            </span>
          )}
        </div>
      </div>
      {(empty || low) && (
        <p className={`notice${empty ? " notice-error" : ""}`} role="status">
          {empty
            ? "Your balance is too low: customers can't create kundlis until you recharge."
            : "Your balance is running low."}{" "}
          Recharge below to keep taking orders.
        </p>
      )}
      <WalletRecharge minPaise={w.minTopupPaise} name={name} />
      {w.transactions.length === 0 ? (
        <p className="muted">No wallet activity yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {w.transactions.map((x) => (
                <tr key={x.id}>
                  <td>
                    {new Date(x.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>
                    {LABEL[x.kind]}
                    {x.note && <span className="muted small"> · {x.note}</span>}
                  </td>
                  <td
                    className="num"
                    style={{ color: x.amountPaise < 0 ? "var(--danger)" : "var(--ok)" }}
                  >
                    {x.amountPaise > 0 ? "+" : "−"}
                    {rs(Math.abs(x.amountPaise))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
