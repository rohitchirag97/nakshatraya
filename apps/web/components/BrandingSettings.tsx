"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client";
import { langName } from "@/lib/i18n";
import { Wheel } from "./Wheel";

export interface Branding {
  name: string;
  logoUrl: string | null;
  brandColor: string;
  defaultLang: string;
  enabledLangs: string[];
  chartStyle: "north" | "south";
  footerText: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

const LANGS = ["en", "hi", "gu"];

/** FR-19: self-serve branding with a live preview of the report cover. */
export function BrandingSettings({ initial }: { initial: Branding }) {
  const router = useRouter();
  const [b, setB] = useState(initial);
  const [msg, setMsg] = useState("");
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => setB((x) => ({ ...x, [k]: v }));
  const blank = (s: string | null) => (s?.trim() ? s.trim() : null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await send(
      "/api/tenant",
      {
        // Only branding fields: the API rejects unknown keys (the page passes in more than these).
        name: b.name,
        brandColor: b.brandColor,
        defaultLang: b.defaultLang,
        enabledLangs: b.enabledLangs,
        chartStyle: b.chartStyle,
        logoUrl: blank(b.logoUrl),
        footerText: blank(b.footerText),
        contactPhone: blank(b.contactPhone),
        contactEmail: blank(b.contactEmail),
      },
      "PATCH",
    );
    setMsg(r.ok ? "Saved." : (r.data?.error ?? "Could not save."));
    if (r.ok) router.refresh();
  }

  function toggleLang(l: string, on: boolean) {
    const picked = on ? [...b.enabledLangs, l] : b.enabledLangs.filter((x) => x !== l);
    const langs = LANGS.filter((x) => picked.includes(x));
    if (!langs.length) return; // at least one language stays on
    // Keep the default among the enabled ones, as the API requires.
    setB((x) => ({
      ...x,
      enabledLangs: langs,
      defaultLang: langs.includes(x.defaultLang) ? x.defaultLang : langs[0]!,
    }));
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h2>Branding</h2>
      <div className="branding">
        <div className="stack">
          <label>
            Business name
            <input
              value={b.name}
              onChange={(e) => set("name", e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label>
            Logo URL (https)
            <input
              type="url"
              value={b.logoUrl ?? ""}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            Brand colour
            <input
              type="color"
              value={b.brandColor}
              onChange={(e) => set("brandColor", e.target.value)}
            />
          </label>
          <fieldset className="stack">
            <legend>Report languages</legend>
            {LANGS.map((l) => (
              <label key={l} className="check">
                <input
                  type="checkbox"
                  checked={b.enabledLangs.includes(l)}
                  onChange={(e) => toggleLang(l, e.target.checked)}
                />
                <span>{langName(l)}</span>
              </label>
            ))}
          </fieldset>
          <label>
            Default language
            <select value={b.defaultLang} onChange={(e) => set("defaultLang", e.target.value)}>
              {b.enabledLangs.map((l) => (
                <option key={l} value={l}>
                  {langName(l)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chart style
            <select
              value={b.chartStyle}
              onChange={(e) => set("chartStyle", e.target.value as Branding["chartStyle"])}
            >
              <option value="north">North Indian</option>
              <option value="south">South Indian</option>
            </select>
          </label>
          <label>
            Footer text on reports
            <textarea
              rows={2}
              maxLength={500}
              value={b.footerText ?? ""}
              onChange={(e) => set("footerText", e.target.value)}
            />
          </label>
          <label>
            Contact phone (+91…)
            <input
              type="tel"
              value={b.contactPhone ?? ""}
              onChange={(e) => set("contactPhone", e.target.value)}
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={b.contactEmail ?? ""}
              onChange={(e) => set("contactEmail", e.target.value)}
            />
          </label>
        </div>

        <figure className="cover-preview" aria-label="Report cover preview">
          <Wheel />
          <div style={{ position: "relative" }}>
            {b.logoUrl ? <img src={b.logoUrl} alt="" /> : <strong>{b.name}</strong>}
          </div>
          <div>
            <div className="t">Kundli</div>
            <div>Customer name</div>
            <small>Date · time · place</small>
          </div>
          <small>
            {b.footerText && (
              <>
                {b.footerText}
                <br />
              </>
            )}
            {[b.name, b.contactPhone, b.contactEmail].filter(Boolean).join(" · ")}
          </small>
        </figure>
      </div>
      {msg && (
        <p className="notice" role="status">
          {msg}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Save branding
      </button>
    </form>
  );
}
