// PRD gate: graha and lagna longitudes within 1 arcminute of Jagannatha Hora on 50 charts.
// Fill golden.json from JH (Lahiri, mean nodes). See packages/engine/README.md for the format.
import { expect, test } from "bun:test";
import { compareGolden, GOLDEN_TARGET, goldenCases, parseJh } from "./golden";

test("parseJh", () => {
  expect(parseJh("15 Ar 23' 12\"")).toBeCloseTo(15.38667, 4);
  expect(parseJh("0 Pi 0' 0\"")).toBe(330);
});

for (const c of goldenCases) {
  test(`golden: ${c.name}`, () => {
    expect(compareGolden(c).off).toEqual([]);
  });
}

if (goldenCases.length < GOLDEN_TARGET)
  test.todo(`golden set incomplete: ${goldenCases.length}/${GOLDEN_TARGET} charts`);
