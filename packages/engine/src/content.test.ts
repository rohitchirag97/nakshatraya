import { expect, test } from "bun:test";
import { computeChart } from "./chart";
import { assembleSections, CONTENT_KEYS, reportKeys } from "./content";
import { LIFE_KEYS } from "./life";

const input = { utc: new Date("1990-01-01T06:30:00Z"), lat: 28.61, lon: 77.21, timeKnown: true };
const at = new Date("2026-11-23T00:00:00Z");

test("key catalogue: 12 lagna + 108 sign + 108 house + 27 nakshatra + 9 dasha + life areas, all unique", () => {
  expect(CONTENT_KEYS).toHaveLength(264 + LIFE_KEYS.length);
  expect(new Set(CONTENT_KEYS).size).toBe(CONTENT_KEYS.length);
});

test("every key a chart asks for is in the catalogue", () => {
  const all = new Set(CONTENT_KEYS);
  for (const timeKnown of [true, false]) {
    const keys = reportKeys(computeChart({ ...input, timeKnown }), at).flatMap((s) => s.keys);
    expect(keys.filter((k) => !all.has(k))).toEqual([]);
  }
});

test("unknown time drops lagna and house keys", () => {
  const sections = reportKeys(computeChart({ ...input, timeKnown: false }), at);
  const keys = sections.flatMap((s) => s.keys);
  expect(keys.some((k) => k.startsWith("lagna:") || k.includes(":house:"))).toBe(false);
  // 9 planet signs, moon nakshatra, current dasha; of the life areas only doshas remain.
  expect(sections.map((s) => s.id)).toEqual(["planets", "moon", "dasha", "doshas"]);
  expect(sections.slice(0, 3).flatMap((s) => s.keys)).toHaveLength(9 + 1 + 1);
});

test("assembly throws on missing text instead of falling back", () => {
  const chart = computeChart(input);
  expect(() => assembleSections(chart, at, new Map())).toThrow(/missing content/);
  const full = new Map(CONTENT_KEYS.map((k) => [k, `text for ${k}`]));
  const sections = assembleSections(chart, at, full);
  expect(sections.map((s) => s.id)).toEqual([
    "lagna", "planets", "moon", "dasha", "doshas", "marriage", "career", "education", "property", "foreign",
  ]); // biome-ignore format: list
  expect(sections[1]!.items).toHaveLength(18);
});
