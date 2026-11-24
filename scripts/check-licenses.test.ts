import { expect, test } from "bun:test";
import { allowed } from "./check-licenses";

test("licence expressions", () => {
  expect(allowed("MIT")).toBe(true);
  expect(allowed("(MIT OR Apache-2.0)")).toBe(true);
  expect(allowed("GPL-3.0 OR MIT")).toBe(true);
  expect(allowed("MIT AND GPL-3.0")).toBe(false);
  expect(allowed("AGPL-3.0-only")).toBe(false);
  expect(allowed("UNLICENSED")).toBe(false);
});
