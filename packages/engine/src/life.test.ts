import { expect, test } from "bun:test";
import { type Chart, computeChart, dignity, GRAHAS, type Graha } from "./chart";
import { CONTENT_KEYS } from "./content";
import { goodPartnerSigns, LIFE_KEYS, lifeSections } from "./life";

const AT = new Date("2026-11-23T00:00:00Z");

/** A chart with planets placed by sign (mid-sign), for testing rules in isolation. */
function fake(lagnaSign: number | null, signs: Partial<Record<Graha, number>>): Chart {
  const base: Record<Graha, number> = {
    Sun: 0, Moon: 1, Mars: 2, Mercury: 0, Jupiter: 4, Venus: 1, Saturn: 6, Rahu: 9, Ketu: 3, ...signs,
  }; // biome-ignore format: table
  return {
    lagna: lagnaSign === null ? null : ({ sign: lagnaSign, lon: lagnaSign * 30 + 1 } as never),
    grahas: GRAHAS.map((graha) => ({
      graha,
      sign: base[graha],
      lon: base[graha] * 30 + 15,
      house: lagnaSign === null ? null : ((base[graha] - lagnaSign + 12) % 12) + 1,
      dignity: dignity(graha, base[graha]),
      combust: false,
      retrograde: false,
    })),
  } as unknown as Chart;
}
const keysOf = (c: Chart) => lifeSections(c, AT).flatMap((s) => s.keys);

test("every key the rules produce is in the catalogue (many real charts)", () => {
  const all = new Set(CONTENT_KEYS);
  expect(LIFE_KEYS.every((k) => all.has(k))).toBe(true);
  for (let i = 0; i < 60; i++) {
    const utc = new Date(Date.UTC(1940 + i, (i * 5) % 12, 1 + (i % 27), (i * 7) % 24));
    for (const timeKnown of [true, false]) {
      const c = computeChart({ utc, lat: 10 + (i % 25), lon: 70 + (i % 18), timeKnown });
      expect(keysOf(c).filter((k) => !all.has(k))).toEqual([]);
    }
  }
});

test("Manglik: Mars in 7th is a dosha; in its own sign it is cancelled", () => {
  // Aries lagna. Mars in Libra (7th, not own/exalted), Jupiter in Taurus (no aspect on Libra).
  expect(keysOf(fake(0, { Mars: 6, Jupiter: 1 }))).toContain("dosha:manglik");
  // Mars in Aries = 1st house, own sign → cancelled.
  const c = keysOf(fake(0, { Mars: 0 }));
  expect(c).toContain("dosha:manglikCancelled");
  expect(c).not.toContain("dosha:manglik");
  // Jupiter aspecting Mars (Jupiter in Gemini, 5th aspect falls on Libra) also cancels.
  expect(keysOf(fake(0, { Mars: 6, Jupiter: 2 }))).toContain("dosha:manglikCancelled");
});

test("Kaal Sarp: all seven planets on one side of the Rahu–Ketu axis", () => {
  // Rahu in Aries (0), Ketu in Libra (6): everything in Taurus..Virgo = one side.
  const yes = fake(0, {
    Rahu: 0,
    Ketu: 6,
    Sun: 1,
    Moon: 2,
    Mars: 3,
    Mercury: 4,
    Jupiter: 5,
    Venus: 1,
    Saturn: 2,
  });
  expect(keysOf(yes)).toContain("dosha:kaalsarp");
  const no = fake(0, { Rahu: 0, Ketu: 6, Sun: 1, Moon: 8 });
  expect(keysOf(no)).not.toContain("dosha:kaalsarp");
});

test("Sade Sati in Nov 2026 for a Moon in Aries (Saturn transiting Pisces)", () => {
  expect(keysOf(fake(0, { Moon: 0 }))).toContain("dosha:sadesati");
  expect(keysOf(fake(0, { Moon: 6 }))).not.toContain("dosha:sadesati");
});

test("no doshas gives an explicit 'none' item", () => {
  // Mars in 3rd, no Rahu/Ketu conjunctions, planets spread, Moon away from Saturn's transit.
  const c = fake(0, {
    Mars: 2,
    Moon: 5, // Virgo: Saturn transiting Pisces is 7th from it, so no Sade Sati or Dhaiya
    Sun: 5,
    Jupiter: 8,
    Saturn: 10,
    Rahu: 3,
    Ketu: 9,
    Mercury: 5,
    Venus: 7,
  });
  const doshas = lifeSections(c, AT).find((s) => s.id === "doshas")!;
  expect(doshas.keys).toEqual(["dosha:none"]);
});

test("unknown birth time: doshas only (no house-based areas, no Manglik)", () => {
  const ids = lifeSections(fake(null, { Mars: 6 }), AT).map((s) => s.id);
  expect(ids).toEqual(["doshas"]);
});

test("obstacles bring their remedies; malefic in 7th", () => {
  const k = lifeSections(fake(0, { Saturn: 6 }), AT).find((s) => s.id === "marriage")!.keys;
  expect(k).toContain("marriage:in7:Saturn");
  expect(k).toContain("obstacle:marriage:malefic");
  expect(k).toContain("remedy:planet:Saturn");
});

test("good partner rashis by Bhakoot: 1, 3, 4, 7, 10, 11 from the Moon", () => {
  expect(goodPartnerSigns(0)).toEqual([0, 2, 3, 6, 9, 10]);
  expect(goodPartnerSigns(11)).toEqual([11, 1, 2, 5, 8, 9]);
});
