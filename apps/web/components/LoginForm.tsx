"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { send } from "@/lib/client";
import { tr } from "@/lib/i18n";

export function LoginForm({ lang, tenantName }: { lang: string; tenantName: string }) {
  const t = tr(lang);
  const router = useRouter();
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await send("/api/auth/otp", { phone: phone.replace(/\s/g, "") });
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.data?.error ?? t("ui.error"));
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await send("/api/auth/verify", { phone: phone.replace(/\s/g, ""), code, consent });
    setBusy(false);
    if (r.ok) router.push("/app");
    else
      setError(
        r.data?.error === "consent required"
          ? t("ui.consentNeeded")
          : (r.data?.error ?? t("ui.error")),
      );
  }

  return (
    <form className="stack" onSubmit={sent ? verify : sendCode}>
      <label>
        {t("ui.phone")}
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={sent}
        />
      </label>
      {sent && (
        <>
          <p className="muted">{t("ui.codeSent", { phone })}</p>
          <label>
            {t("ui.code")}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>{t("ui.consent", { name: tenantName })}</span>
          </label>
        </>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {sent ? t("ui.verify") : t("ui.sendCode")}
      </button>
    </form>
  );
}
