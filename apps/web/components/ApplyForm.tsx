"use client";

import { useState } from "react";
import { send } from "@/lib/client";
import { Check } from "./Icons";

/** Public "become a partner" form on the platform website. */
export function ApplyForm() {
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    const r = await send("/api/apply", {
      businessName: v("businessName"),
      contactName: v("contactName"),
      phone: v("phone").replace(/[\s-]/g, ""),
      email: v("email") || null,
      city: v("city"),
      preferredSlug: v("slug").toLowerCase() || null,
      wantsShop: f.get("shop") === "on",
      wantsConsult: f.get("consult") === "on",
      pdfPricePaise: Math.round(Number(v("pdfPrice")) * 100),
      printPricePaise: Math.round(Number(v("printPrice")) * 100),
      message: v("message") || null,
    });
    setBusy(false);
    if (r.ok) setDone(true);
    else setMsg(r.data?.error ?? "Please check the form and try again.");
  }

  if (done)
    return (
      <div className="card stack" role="status">
        <span className="icon-badge" aria-hidden="true">
          <Check />
        </span>
        <h3>Application received</h3>
        <p className="muted">
          Thank you. We will call you on the number you gave within two working days to set up your
          site.
        </p>
      </div>
    );

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Business or brand name
          <input name="businessName" required minLength={2} maxLength={100} />
        </label>
        <label>
          Your name
          <input name="contactName" required minLength={2} maxLength={100} autoComplete="name" />
        </label>
        <label>
          Mobile number
          <input name="phone" type="tel" required defaultValue="+91" autoComplete="tel" />
        </label>
        <label>
          Email (optional)
          <input name="email" type="email" maxLength={200} autoComplete="email" />
        </label>
        <label>
          City
          <input name="city" required minLength={2} maxLength={80} />
        </label>
        <label>
          Preferred site name (optional)
          <input
            name="slug"
            placeholder="e.g. shubhjyotish"
            pattern="[a-zA-Z0-9][a-zA-Z0-9\-]{1,28}[a-zA-Z0-9]"
            title="3-30 letters, digits or hyphens"
            maxLength={30}
          />
        </label>
        <label>
          Your price for the PDF kundli (₹)
          <input name="pdfPrice" type="number" min={0} step={1} required defaultValue={99} />
        </label>
        <label>
          Your price for a printed kundli (₹, PDF included)
          <input name="printPrice" type="number" min={0} step={1} required defaultValue={500} />
        </label>
      </div>
      <fieldset className="stack" style={{ gap: 8 }}>
        <legend>Also offer (you can change this later)</legend>
        <label className="check">
          <input type="checkbox" name="shop" />
          <span>A shop for remedy products</span>
        </label>
        <label className="check">
          <input type="checkbox" name="consult" />
          <span>Online consultation for customers</span>
        </label>
      </fieldset>
      <label>
        Anything else we should know? (optional)
        <textarea name="message" rows={3} maxLength={1000} />
      </label>
      {msg && (
        <p className="notice notice-error" role="alert">
          {msg}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Sending…" : "Apply now"}
      </button>
    </form>
  );
}
