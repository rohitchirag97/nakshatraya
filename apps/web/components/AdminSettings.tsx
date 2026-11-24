"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client";

interface Props {
  pricePaise: number;
  printPricePaise: number;
  gstin: string | null;
  legalName: string | null;
  address: string | null;
  shopEnabled: boolean;
  consultEnabled: boolean;
}

/** Price and GST details: what the owner needs before selling (FR-19 subset, FR-23). */
export function AdminSettings({
  pricePaise,
  printPricePaise,
  gstin,
  legalName,
  address,
  shopEnabled,
  consultEnabled,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim() || null;
    const r = await send(
      "/api/tenant",
      {
        kundliPricePaise: Math.round(Number(f.get("price")) * 100),
        printPricePaise: Math.round(Number(f.get("printPrice")) * 100),
        gstin: text("gstin"),
        legalName: text("legalName"),
        address: text("address"),
        shopEnabled: f.get("shop") === "on",
        consultEnabled: f.get("consult") === "on",
      },
      "PATCH",
    );
    setMsg(r.ok ? "Saved." : (r.data?.error ?? "Could not save."));
    if (r.ok) router.refresh();
  }

  return (
    <form className="card stack" onSubmit={save} style={{ alignSelf: "start" }}>
      <h2>What you offer</h2>
      <label className="check">
        <input type="checkbox" name="shop" defaultChecked={shopEnabled} />
        <span>
          Shop (remedy products) <span className="muted small">· coming soon</span>
        </span>
      </label>
      <label className="check">
        <input type="checkbox" name="consult" defaultChecked={consultEnabled} />
        <span>
          Online consultation for customers <span className="muted small">· coming soon</span>
        </span>
      </label>
      <h3 style={{ margin: "8px 0 0" }}>Prices and GST</h3>
      <label>
        Digital PDF price (₹, including GST)
        <input
          name="price"
          type="number"
          min={0}
          step="1"
          required
          defaultValue={pricePaise / 100}
        />
      </label>
      <label>
        Printed copy price (₹, including GST and posting; PDF included)
        <input
          name="printPrice"
          type="number"
          min={0}
          step="1"
          required
          defaultValue={printPricePaise / 100}
        />
      </label>
      <label>
        GSTIN (leave empty if not registered)
        <input
          name="gstin"
          defaultValue={gstin ?? ""}
          maxLength={15}
          style={{ textTransform: "uppercase" }}
        />
      </label>
      <label>
        Legal name on invoices
        <input name="legalName" defaultValue={legalName ?? ""} maxLength={200} />
      </label>
      <label>
        Address on invoices
        <textarea name="address" defaultValue={address ?? ""} maxLength={500} rows={3} />
      </label>
      {msg && (
        <p className="notice" role="status">
          {msg}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Save
      </button>
    </form>
  );
}
