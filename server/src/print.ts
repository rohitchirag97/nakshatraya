import { PDFDocument } from "pdf-lib";

// Print layouts made from the rendered report PDF: drop the cover (the astrologer uses their own),
// and A5 booklets imposed two pages per A4 sheet for duplex printing, fold and staple.

const A4_LANDSCAPE: [number, number] = [841.89, 595.28]; // points

/**
 * Page order for a saddle-stitched booklet of `pages` (a multiple of 4), 0-based.
 * Each sheet has a front [left, right] and a back [left, right].
 */
export function bookletOrder(pages: number) {
  const sheets: { front: [number, number]; back: [number, number] }[] = [];
  for (let s = 0; s < pages / 4; s++)
    sheets.push({
      front: [pages - 1 - 2 * s, 2 * s],
      back: [2 * s + 1, pages - 2 - 2 * s],
    });
  return sheets;
}

export async function printLayout(
  pdf: Uint8Array,
  opts: { cover: boolean; booklet: boolean },
): Promise<Uint8Array<ArrayBuffer>> {
  const src = await PDFDocument.load(pdf);
  if (!opts.cover && src.getPageCount() > 1) src.removePage(0);
  if (!opts.booklet) return new Uint8Array(await src.save());

  const n = src.getPageCount();
  const total = Math.ceil(n / 4) * 4; // blank pages pad the end
  const out = await PDFDocument.create();
  // A page with no content (a blank trailing page) can't be embedded: print it as blank.
  const embedded = await Promise.all(
    src.getPages().map((p) => out.embedPage(p).catch(() => undefined)),
  );
  const [W, H] = A4_LANDSCAPE;
  const half = W / 2;
  const place = (sheet: ReturnType<PDFDocument["addPage"]>, idx: number, x0: number) => {
    const p = idx < n ? embedded[idx] : undefined;
    if (!p) return; // blank
    const scale = Math.min(half / p.width, H / p.height);
    const w = p.width * scale;
    const h = p.height * scale;
    sheet.drawPage(p, { x: x0 + (half - w) / 2, y: (H - h) / 2, width: w, height: h });
  };
  for (const { front, back } of bookletOrder(total)) {
    for (const [l, r] of [front, back]) {
      const sheet = out.addPage(A4_LANDSCAPE);
      place(sheet, l, 0);
      place(sheet, r, half);
    }
  }
  return new Uint8Array(await out.save());
}
