"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client";
import { inr } from "@/lib/i18n";

const PRESETS = [500, 1000, 2000, 5000];

/** Owner recharges the platform wallet online (Razorpay; test mode locally). */
export function WalletRecharge({ minPaise, name }: { minPaise: number; name: string }) {
  const router = useRouter();
  const [rupees, setRupees] = useState(1000);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const done = () => {
    setMsg({ ok: true, text: "Recharge successful. Your balance is updated." });
    router.refresh();
  };

  async function recharge(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const o = await send("/api/tenant/wallet/topup", { amountPaise: Math.round(rupees * 100) });
      if (!o.ok)
        return setMsg({ ok: false, text: o.data?.error ?? "Could not start the payment." });
      if (o.data.fake) {
        if (!confirm(`TEST MODE: no real payment.\nAdd ${inr(o.data.amount, "en")} to the wallet?`))
          return;
        const v = await send("/api/tenant/wallet/topup/fake-pay", {
          razorpayOrderId: o.data.razorpayOrderId,
        });
        return v.ok ? done() : setMsg({ ok: false, text: v.data?.error ?? "Payment failed." });
      }
      if (!window.Razorpay)
        return setMsg({ ok: false, text: "Payment page didn't load. Refresh and try again." });
      const rz = new window.Razorpay({
        key: o.data.keyId,
        amount: o.data.amount,
        currency: o.data.currency,
        order_id: o.data.razorpayOrderId,
        name,
        description: "Wallet recharge",
        handler: async (resp: Record<string, string>) => {
          // If this check fails, the Razorpay webhook still credits the wallet shortly after.
          await send("/api/tenant/wallet/topup/verify", resp);
          done();
        },
      });
      rz.on("payment.failed", () =>
        setMsg({ ok: false, text: "Payment failed. No money was taken." }),
      );
      rz.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" style={{ gap: 10, marginBottom: 16 }} onSubmit={recharge}>
      <div className="row">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className={`btn btn-sm ${rupees === p ? "btn-primary" : "btn-ghost"}`}
            aria-pressed={rupees === p}
            onClick={() => setRupees(p)}
          >
            {inr(p * 100, "en")}
          </button>
        ))}
        <input
          type="number"
          min={minPaise / 100}
          max={100000}
          step={1}
          required
          value={rupees}
          onChange={(e) => setRupees(Number(e.target.value))}
          aria-label="Recharge amount in rupees"
          style={{ width: 130 }}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Recharge {inr(Math.round(rupees * 100), "en")}
        </button>
      </div>
      {msg && (
        <p className={`notice${msg.ok ? "" : " notice-error"}`} role="status">
          {msg.text}
        </p>
      )}
    </form>
  );
}
