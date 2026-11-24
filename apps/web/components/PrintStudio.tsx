"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "./Icons";

type Size = "a5" | "a4";
type Layout = "pages" | "booklet";
interface Opts {
  size: Size;
  layout: Layout;
  cover: boolean;
  bw: boolean;
}

const DEFAULTS: Opts = { size: "a5", layout: "booklet", cover: true, bw: false };
const KEY = "print-options"; // remembered per browser: an astrologer usually prints the same way

const HOW: Record<string, string[]> = {
  booklet: [
    "Paper: A4. Scale: Actual size / 100% (not “Fit”).",
    "Two-sided: on, flip on the SHORT edge.",
    "Fold the printed stack in half and staple on the fold: an A5 book.",
  ],
  a5: [
    "Load A5 paper. Paper size: A5. Scale: Actual size / 100%.",
    "Two-sided printing is optional; bind or staple on the left.",
  ],
  a4: ["Paper size: A4. Scale: Actual size / 100%."],
};

/** Print options, a preview of the exact PDF that will print, and the browser's print dialog. */
export function PrintStudio({ reportId }: { reportId: string }) {
  const [o, setO] = useState<Opts>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  // Browsers without a built-in PDF viewer (e.g. Chrome on Android) can't preview or print from a
  // frame: they get the PDF to open in their own viewer and print from there.
  const [viewer, setViewer] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setViewer(navigator.pdfViewerEnabled !== false);
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved) setO({ ...DEFAULTS, ...saved });
    } catch {}
  }, []);
  const set = (p: Partial<Opts>) => {
    const next = { ...o, ...p };
    if (next.size === "a4") next.layout = "pages"; // booklets are A5 on folded A4
    setO(next);
    setLoading(true);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };

  const src = `/api/reports/${reportId}/pdf?size=${o.size}&cover=${o.cover ? 1 : 0}${o.layout === "booklet" ? "&layout=booklet" : ""}${o.bw ? "&color=bw" : ""}`;
  const how = HOW[o.layout === "booklet" ? "booklet" : o.size]!;

  return (
    <div className="print-studio">
      <aside className="card stack">
        <fieldset className="stack" style={{ gap: 8 }}>
          <legend>Paper size</legend>
          {(
            [
              ["a5", "A5 (148 × 210 mm)", "Usual kundli size"],
              ["a4", "A4 (210 × 297 mm)", "Full page"],
            ] as const
          ).map(([v, label, hint]) => (
            <label className="check" key={v}>
              <input
                type="radio"
                name="size"
                checked={o.size === v}
                onChange={() => set({ size: v })}
              />
              <span>
                {label} <span className="muted small">· {hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="stack" style={{ gap: 8 }} disabled={o.size !== "a5"}>
          <legend>Format</legend>
          <label className="check">
            <input
              type="radio"
              name="layout"
              checked={o.layout === "booklet"}
              onChange={() => set({ layout: "booklet" })}
            />
            <span>
              Book <span className="muted small">· 2 pages per A4 sheet, fold &amp; staple</span>
            </span>
          </label>
          <label className="check">
            <input
              type="radio"
              name="layout"
              checked={o.layout === "pages"}
              onChange={() => set({ layout: "pages" })}
            />
            <span>
              Single pages <span className="muted small">· one page per sheet</span>
            </span>
          </label>
        </fieldset>

        <fieldset className="stack" style={{ gap: 8 }}>
          <legend>Printer</legend>
          <label className="check">
            <input type="radio" name="bw" checked={!o.bw} onChange={() => set({ bw: false })} />
            <span>
              Colour <span className="muted small">· charts on aged paper</span>
            </span>
          </label>
          <label className="check">
            <input type="radio" name="bw" checked={o.bw} onChange={() => set({ bw: true })} />
            <span>
              Black &amp; white{" "}
              <span className="muted small">· plain charts, no background, crisp black text</span>
            </span>
          </label>
        </fieldset>

        <label className="check">
          <input
            type="checkbox"
            checked={o.cover}
            onChange={(e) => set({ cover: e.target.checked })}
          />
          <span>
            Include our cover page{" "}
            <span className="muted small">· untick to use your own printed cover</span>
          </span>
        </label>

        <div className="notice small">
          <strong>In the print dialog</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>Choose your printer from the Destination / Printer list.</li>
            {how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>

        {viewer ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={loading}
              onClick={() => frame.current?.contentWindow?.print()}
            >
              {loading ? "Preparing…" : "Print"}
            </button>
            <a className="btn btn-ghost" href={src} target="_blank" rel="noreferrer">
              <Download /> Open PDF (for a print shop)
            </a>
          </>
        ) : (
          <a className="btn btn-primary btn-lg" href={src} target="_blank" rel="noreferrer">
            <Download /> Open PDF to print
          </a>
        )}
      </aside>

      <section className="print-preview" aria-label="Print preview">
        {viewer ? (
          <>
            {loading && <p className="print-loading muted">Preparing the preview…</p>}
            <iframe
              key={src}
              ref={frame}
              src={src}
              title="Print preview"
              onLoad={() => setLoading(false)}
            />
          </>
        ) : (
          <p className="print-loading muted">
            This browser can&apos;t show PDFs inside the page. Tap “Open PDF to print”: it opens in
            your PDF viewer, where you can check every page and print.
          </p>
        )}
      </section>
    </div>
  );
}
