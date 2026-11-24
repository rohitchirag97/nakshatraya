import { expect, test } from "bun:test";
import { AV_PLANETS, ashtakavarga } from "./ashtakavarga";
import { computeChart } from "./chart";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
// Classical totals: they depend only on the tables, never on the chart.
const TOTALS = { Sun: 48, Moon: 49, Mars: 39, Mercury: 54, Jupiter: 56, Venus: 52, Saturn: 39 };

test.each([
  ["1991-08-29T15:30:00Z", 22.75, 72.68],
  ["1950-01-26T05:00:00Z", 28.61, 77.21],
  ["2024-12-31T18:29:00Z", 13.08, 80.27],
])("totals and ranges hold for %s", (utc, lat, lon) => {
  const av = ashtakavarga(computeChart({ utc: new Date(utc), lat, lon, timeKnown: true }))!;
  for (const p of AV_PLANETS) {
    expect([p, sum(av.bav[p])]).toEqual([p, TOTALS[p]]);
    expect(av.bav[p].every((n) => n >= 0 && n <= 8)).toBe(true);
  }
  expect(sum(av.sav)).toBe(337);
  for (let s = 0; s < 12; s++) expect(av.sav[s]).toBe(sum(AV_PLANETS.map((p) => av.bav[p][s]!)));
});

test("hand-checked: every contributor in Aries gives Sun's own-sign bindus", () => {
  // Lagna and all planets in Aries: Sun's BAV in Aries = contributors that list house 1 for Sun
  // (Sun, Mars, Saturn) = 3; in Taurus (house 2) the same three = 3; in Gemini (house 3) Moon,
  // Mercury, Lagna = 3.
  const grahas = AV_PLANETS.map((graha) => ({ graha, sign: 0 }));
  const av = ashtakavarga({ lagna: { sign: 0 } as never, grahas: grahas as never })!;
  expect(av.bav.Sun.slice(0, 3)).toEqual([3, 3, 3]);
});

test("unknown birth time: no ashtakavarga (the lagna is a contributor)", () => {
  const c = computeChart({
    utc: new Date("1991-08-29T15:30:00Z"),
    lat: 22.75,
    lon: 72.68,
    timeKnown: false,
  });
  expect(ashtakavarga(c)).toBeNull();
});
