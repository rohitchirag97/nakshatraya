import { expect, test } from "bun:test";
import { percentile } from "./load-test";

test("percentile (nearest rank)", () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  expect(percentile(xs, 50)).toBe(10);
  expect(percentile(xs, 95)).toBe(19);
  expect(percentile(xs, 100)).toBe(20);
  expect(percentile([7], 95)).toBe(7);
  expect(percentile([], 95)).toBeNaN();
});
