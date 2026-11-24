"use client";

import { useEffect, useRef, useState } from "react";
import { inr, tr } from "@/lib/i18n";
import { Check, Download, Scroll } from "./Icons";

export interface Ship {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Digital PDF or printed copy (PDF included). The PDF option is hidden when the report is already
 * unlocked (then it's only "order a printed copy").
 */
export function BuyDialog({
  lang,
  pdfPaise,
  printPaise,
  allowPdf,
  onPay,
  onClose,
}: {
  lang: string;
  pdfPaise: number;
  printPaise: number;
  allowPdf: boolean;
  onPay: (kind: "pdf" | "print", ship?: Ship) => void;
  onClose: () => void;
}) {
  const t = tr(lang);
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<"pdf" | "print">(allowPdf ? "pdf" : "print");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (kind === "pdf") return onPay("pdf");
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    onPay("print", {
      name: v("name"),
      phone: v("phone").replace(/\s/g, ""),
      address: v("address"),
      city: v("city"),
      state: v("state"),
      pincode: v("pincode"),
    });
  }

  const option = (
    k: "pdf" | "print",
    title: string,
    body: string,
    paise: number,
    Icon: typeof Scroll,
  ) => (
    <label className={`buy-option${kind === k ? " selected" : ""}`}>
      <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
      <span className="icon-badge" aria-hidden="true">
        <Icon />
      </span>
      <span>
        <strong>{title}</strong>
        <span className="muted small">{body}</span>
      </span>
      <span className="buy-price">{inr(paise, lang)}</span>
      {kind === k && <Check className="icon buy-check" />}
    </label>
  );

  return (
    <dialog ref={ref} className="buy-dialog" onClose={onClose} aria-labelledby="buy-title">
      <form className="stack" onSubmit={submit}>
        <div className="card-head">
          <h2 id="buy-title">{t("buy.title")}</h2>
          <button type="button" className="btn-link" onClick={() => ref.current?.close()}>
            {t("buy.close")}
          </button>
        </div>
        {allowPdf && option("pdf", t("buy.pdf"), t("buy.pdfBody"), pdfPaise, Download)}
        {option("print", t("buy.print"), t("buy.printBody"), printPaise, Scroll)}

        {kind === "print" && (
          <fieldset className="form-grid">
            <legend>{t("buy.address")}</legend>
            <label>
              {t("buy.shipName")}
              <input name="name" required maxLength={100} autoComplete="name" />
            </label>
            <label>
              {t("buy.shipPhone")}
              <input name="phone" type="tel" required defaultValue="+91" autoComplete="tel" />
            </label>
            <label className="span-2">
              {t("buy.shipAddress")}
              <input
                name="address"
                required
                minLength={5}
                maxLength={300}
                autoComplete="street-address"
              />
            </label>
            <label>
              {t("buy.shipCity")}
              <input name="city" required maxLength={80} autoComplete="address-level2" />
            </label>
            <label>
              {t("buy.shipState")}
              <input name="state" required maxLength={80} autoComplete="address-level1" />
            </label>
            <label>
              {t("buy.shipPincode")}
              <input
                name="pincode"
                required
                inputMode="numeric"
                pattern="[1-9][0-9]{5}"
                maxLength={6}
                autoComplete="postal-code"
              />
            </label>
          </fieldset>
        )}
        <button type="submit" className="btn btn-primary btn-lg">
          {t("buy.continue")} · {inr(kind === "pdf" ? pdfPaise : printPaise, lang)}
        </button>
      </form>
    </dialog>
  );
}
