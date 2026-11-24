import { type Chart, GRAHAS, NAKSHATRAS, SIGNS } from "./chart";
import { currentDasha, type DashaLord } from "./dasha";
import { LIFE_KEYS, type LifeSection, lifeSections } from "./life";

// FR-11: report text is looked up by chart facts. These are every key the kundli report can ask for.
const LORDS: DashaLord[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
]; // biome-ignore format: list

export const CONTENT_KEYS: string[] = [
  ...SIGNS.map((s) => `lagna:sign:${s}`),
  ...GRAHAS.flatMap((g) => SIGNS.map((s) => `planet:${g}:sign:${s}`)),
  ...GRAHAS.flatMap((g) => Array.from({ length: 12 }, (_, i) => `planet:${g}:house:${i + 1}`)),
  ...NAKSHATRAS.map((n) => `moon:nakshatra:${n}`),
  ...LORDS.map((l) => `dasha:${l}`),
  ...LIFE_KEYS,
];

export type SectionId = "lagna" | "planets" | "moon" | "dasha" | LifeSection["id"];
export interface Section {
  id: SectionId;
  items: { key: string; text: string }[];
}

/** Keys this chart needs, grouped into report sections. Lagna and houses drop out if time is unknown (FR-1). */
export function reportKeys(chart: Chart, at: Date): { id: SectionId; keys: string[] }[] {
  const lagna = chart.lagna;
  const moon = chart.grahas.find((g) => g.graha === "Moon")!;
  const md = currentDasha(chart.dasha, at)?.md;
  return [
    { id: "lagna" as const, keys: lagna ? [`lagna:sign:${SIGNS[lagna.sign]}`] : [] },
    {
      id: "planets" as const,
      keys: chart.grahas.flatMap((g) => [
        `planet:${g.graha}:sign:${SIGNS[g.sign]}`,
        ...(g.house ? [`planet:${g.graha}:house:${g.house}`] : []),
      ]),
    },
    { id: "moon" as const, keys: [`moon:nakshatra:${NAKSHATRAS[moon.nakshatra]}`] },
    { id: "dasha" as const, keys: md ? [`dasha:${md.lord}`] : [] },
    ...lifeSections(chart, at),
  ].filter((s) => s.keys.length);
}

/** Fill the sections from reviewed text. Throws on a missing key: FR-16 forbids quiet fallbacks. */
export function assembleSections(
  chart: Chart,
  at: Date,
  text: ReadonlyMap<string, string>,
): Section[] {
  return reportKeys(chart, at).map(({ id, keys }) => ({
    id,
    items: keys.map((key) => {
      const t = text.get(key);
      if (t === undefined) throw new Error(`missing content: ${key}`);
      return { key, text: t };
    }),
  }));
}
