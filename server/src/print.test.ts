import { expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { bookletOrder, printLayout } from "./print";

const A5: [number, number] = [419.53, 595.28];
async function a5Pdf(pages: number) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage(A5).drawText(`page ${i + 1}`, { x: 40, y: 40 });
  return d.save();
}
const pagesOf = async (b: Uint8Array) => (await PDFDocument.load(b)).getPages();

test("booklet order: 8 pages fold into 2 sheets, front 8|1 back 2|7, front 6|3 back 4|5", () => {
  expect(bookletOrder(8)).toEqual([
    { front: [7, 0], back: [1, 6] },
    { front: [5, 2], back: [3, 4] },
  ]);
  // Every page lands exactly once.
  const all = bookletOrder(16).flatMap((s) => [...s.front, ...s.back]);
  expect(all.sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
});

test("without the cover the first page is dropped", async () => {
  expect(
    await pagesOf(await printLayout(await a5Pdf(6), { cover: false, booklet: false })),
  ).toHaveLength(5);
  expect(
    await pagesOf(await printLayout(await a5Pdf(6), { cover: true, booklet: false })),
  ).toHaveLength(6);
});

test("booklet: A5 pages two per A4 landscape side, padded to a multiple of 4", async () => {
  const out = await pagesOf(await printLayout(await a5Pdf(5), { cover: true, booklet: true }));
  expect(out).toHaveLength(4); // 5 pages → 8 → 2 sheets × 2 sides
  const { width, height } = out[0]!.getSize();
  expect([Math.round(width), Math.round(height)]).toEqual([842, 595]);
});
