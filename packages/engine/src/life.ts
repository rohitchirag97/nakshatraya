// Rule-based life-area analysis (FR-8 doshas + per-area indications, obstacles and remedies).
// Every rule only picks content keys from chart facts; the words come from the reviewed library (FR-11).
import { ayanamsa, norm, time, tropicalLongitude } from "./astro";
import { type Chart, GRAHAS, type Graha, type GrahaPosition, SIGNS } from "./chart";

const RULER: Graha[] = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter",
]; // biome-ignore format: list
const MALEFICS: Graha[] = ["Sun", "Mars", "Saturn", "Rahu", "Ketu"];
const DUSTHANA = [6, 8, 12];
const SEVEN: Graha[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];

export type Strength = "strong" | "weak" | "neutral";
export const DOSHAS = [
  "manglik", "manglikCancelled", "kaalsarp", "sadesati", "dhaiya", "pitru", "grahan", "guruchandal", "shrapit",
] as const; // biome-ignore format: list
export type Dosha = (typeof DOSHAS)[number];
export const LIFE_AREAS = ["marriage", "career", "education", "property", "foreign"] as const;
export type LifeArea = (typeof LIFE_AREAS)[number];

/** Partner Moon signs with good Bhakoot: 1st, 3rd, 4th, 7th, 10th and 11th from your Moon. */
export const goodPartnerSigns = (moonSign: number) =>
  [0, 2, 3, 6, 9, 10].map((o) => (moonSign + o) % 12);

const H = Array.from({ length: 12 }, (_, i) => i + 1);
const STATES: Strength[] = ["strong", "weak", "neutral"];
const FIELD_GRAHAS = GRAHAS;

// Every key these rules can produce; part of the content catalogue (FR-16 coverage).
export const LIFE_KEYS: string[] = [
  "dosha:none",
  ...DOSHAS.map((d) => `dosha:${d}`),
  ...DOSHAS.filter((d) => d !== "manglikCancelled").map((d) => `remedy:dosha:${d}`),
  ...GRAHAS.map((g) => `remedy:planet:${g}`),
  ...SIGNS.map((s) => `marriage:7th:sign:${s}`),
  ...H.map((h) => `marriage:7lord:house:${h}`),
  ...GRAHAS.map((g) => `marriage:in7:${g}`),
  ...STATES.map((s) => `marriage:venus:${s}`),
  ...SIGNS.map((s) => `career:10th:sign:${s}`),
  ...H.map((h) => `career:10lord:house:${h}`),
  ...GRAHAS.map((g) => `career:in10:${g}`),
  ...FIELD_GRAHAS.map((g) => `career:field:${g}`),
  ...["job", "business", "both"].map((m) => `career:mode:${m}`),
  ...H.map((h) => `education:5lord:house:${h}`),
  ...STATES.map((s) => `education:mercury:${s}`),
  ...STATES.map((s) => `education:jupiter:${s}`),
  ...H.map((h) => `property:4lord:house:${h}`),
  ...STATES.map((s) => `property:venus:${s}`),
  ...STATES.map((s) => `property:mars:${s}`),
  ...["high", "medium", "low"].map((l) => `foreign:likely:${l}`),
  ...["rahu", "lord12", "lord9in12", "moon12", "lagnalord"].map((i) => `foreign:ind:${i}`),
  ...(["marriage", "career", "education", "property"] as const).flatMap((a) => [
    `obstacle:${a}:malefic`,
    `obstacle:${a}:lordDusthana`,
  ]),
];

export interface LifeSection {
  id: "doshas" | LifeArea;
  keys: string[];
}

/** Doshas and life-area keys. Needs the lagna for everything house-based; Sade Sati uses `at`. */
export function lifeSections(chart: Chart, at: Date): LifeSection[] {
  const g = (name: Graha) => chart.grahas.find((x) => x.graha === name)!;
  const moon = g("Moon");
  const strength = (p: GrahaPosition): Strength =>
    p.dignity === "exalted" || p.dignity === "own"
      ? "strong"
      : p.dignity === "debilitated" || p.combust || (p.house !== null && DUSTHANA.includes(p.house))
        ? "weak"
        : "neutral";

  // ── doshas (some need the lagna) ──
  const doshas: Dosha[] = [];
  const lagna = chart.lagna;
  const signOfHouse = (h: number) => (lagna!.sign + h - 1) % 12;
  const lordOf = (h: number) => g(RULER[signOfHouse(h)]!);
  const inHouse = (h: number) => chart.grahas.filter((p) => p.house === h);
  const together = (a: Graha, b: Graha) => g(a).sign === g(b).sign;
  // Graha (sign-based) aspects: all on the 7th; Mars 4/8, Jupiter 5/9, Saturn 3/10.
  const aspects = (from: GrahaPosition, toSign: number) => {
    const d = ((toSign - from.sign + 12) % 12) + 1;
    const extra: Partial<Record<Graha, number[]>> = {
      Mars: [4, 8],
      Jupiter: [5, 9],
      Saturn: [3, 10],
    };
    return d === 7 || (extra[from.graha] ?? []).includes(d);
  };

  if (lagna) {
    const mars = g("Mars");
    if ([1, 2, 4, 7, 8, 12].includes(mars.house!)) {
      // Classical cancellations: Mars in own/exalted sign, or with or aspected by Jupiter.
      const cancelled =
        mars.dignity === "own" ||
        mars.dignity === "exalted" ||
        together("Mars", "Jupiter") ||
        aspects(g("Jupiter"), mars.sign);
      doshas.push(cancelled ? "manglikCancelled" : "manglik");
    }
    const ninth = inHouse(9).map((p) => p.graha);
    if (ninth.includes("Rahu") || ninth.includes("Ketu") || together("Sun", "Rahu"))
      doshas.push("pitru");
  }
  const rahu = g("Rahu").lon;
  const side = SEVEN.map((p) => norm(g(p).lon - rahu) < 180);
  if (side.every(Boolean) || side.every((x) => !x)) doshas.push("kaalsarp");

  const t = time(at);
  const saturnNow = Math.floor(norm(tropicalLongitude("Saturn", t) - ayanamsa(t)) / 30);
  const fromMoon = (saturnNow - moon.sign + 12) % 12;
  if ([11, 0, 1].includes(fromMoon)) doshas.push("sadesati");
  else if ([3, 7].includes(fromMoon)) doshas.push("dhaiya");

  if (["Sun", "Moon"].some((l) => ["Rahu", "Ketu"].some((n) => together(l as Graha, n as Graha))))
    doshas.push("grahan");
  if (together("Jupiter", "Rahu")) doshas.push("guruchandal");
  if (together("Saturn", "Rahu")) doshas.push("shrapit");

  const sections: LifeSection[] = [
    {
      id: "doshas",
      keys: [
        ...(doshas.length ? [] : ["dosha:none"]),
        ...doshas.map((d) => `dosha:${d}`),
        ...doshas.filter((d) => d !== "manglikCancelled").map((d) => `remedy:dosha:${d}`),
      ],
    },
  ];
  if (!lagna) return sections;

  // ── life areas ──
  const area = (
    id: LifeArea,
    house: number,
    indications: string[],
    weakPlanets: GrahaPosition[],
    extra: string[] = [],
  ): LifeSection => {
    const keys = [...indications];
    const obstacles: string[] = [];
    const fixes = new Set<string>();
    if (id !== "foreign") {
      const bad = inHouse(house).filter((p) => MALEFICS.includes(p.graha));
      if (bad.length) {
        obstacles.push(`obstacle:${id}:malefic`);
        for (const p of bad) fixes.add(`remedy:planet:${p.graha}`);
      }
      const lord = lordOf(house);
      if (DUSTHANA.includes(lord.house!)) {
        obstacles.push(`obstacle:${id}:lordDusthana`);
        fixes.add(`remedy:planet:${lord.graha}`);
      }
    }
    for (const p of weakPlanets) fixes.add(`remedy:planet:${p.graha}`);
    return { id, keys: [...keys, ...extra, ...obstacles, ...fixes] };
  };

  const lord7 = lordOf(7);
  const venus = g("Venus");
  // Manglik and its remedy are covered once, in the Doshas section.
  const marriage = area(
    "marriage",
    7,
    [
      `marriage:7th:sign:${SIGNS[signOfHouse(7)]}`,
      `marriage:7lord:house:${lord7.house}`,
      ...inHouse(7).map((p) => `marriage:in7:${p.graha}`),
      `marriage:venus:${strength(venus)}`,
    ],
    strength(venus) === "weak" ? [venus] : [],
  );

  const lord10 = lordOf(10);
  const fields = [...new Set([lord10.graha, ...inHouse(10).map((p) => p.graha)])];
  const lord7Good =
    strength(lord7) === "strong" || [10, 11].includes(lord7.house!) || lord10.house === 7;
  const business = lord7Good || strength(g("Mercury")) === "strong";
  const job = strength(g("Saturn")) === "strong" || lord10.house === 6 || inHouse(6).length > 0;
  const career = area(
    "career",
    10,
    [
      `career:10th:sign:${SIGNS[signOfHouse(10)]}`,
      `career:10lord:house:${lord10.house}`,
      ...inHouse(10).map((p) => `career:in10:${p.graha}`),
      ...fields.map((f) => `career:field:${f}`),
      `career:mode:${business && job ? "both" : business ? "business" : "job"}`,
    ],
    [g("Sun"), g("Saturn")].filter((p) => strength(p) === "weak"),
  );

  const mercury = g("Mercury");
  const jupiter = g("Jupiter");
  const education = area(
    "education",
    5,
    [
      `education:5lord:house:${lordOf(5).house}`,
      `education:mercury:${strength(mercury)}`,
      `education:jupiter:${strength(jupiter)}`,
    ],
    [mercury, jupiter].filter((p) => strength(p) === "weak"),
  );

  const mars = g("Mars");
  const property = area(
    "property",
    4,
    [
      `property:4lord:house:${lordOf(4).house}`,
      `property:venus:${strength(venus)}`,
      `property:mars:${strength(mars)}`,
    ],
    [venus, mars].filter((p) => strength(p) === "weak"),
  );

  // Foreign travel / settlement indicators.
  const ind: string[] = [];
  if ([1, 7, 9, 12].includes(g("Rahu").house!)) ind.push("rahu");
  if ([9, 12].includes(lordOf(12).house!)) ind.push("lord12");
  if (lordOf(9).house === 12) ind.push("lord9in12");
  if (moon.house === 12) ind.push("moon12");
  if ([9, 12].includes(lordOf(1).house!)) ind.push("lagnalord");
  const likely = ind.length >= 3 ? "high" : ind.length >= 1 ? "medium" : "low";
  const foreign = area(
    "foreign",
    12,
    [`foreign:likely:${likely}`, ...ind.map((i) => `foreign:ind:${i}`)],
    [],
  );

  return [...sections, marriage, career, education, property, foreign];
}
