// Golden-set comparison against Jagannatha Hora (PRD accuracy gate), shared by the test and the
// public accuracy page so both report the same numbers.
import { computeChart, GRAHAS, SIGNS } from "./chart";
import golden from "./golden.json";

export interface GoldenCase {
  name: string;
  utc: string;
  lat: number;
  lon: number;
  expected: Record<string, string>; // "Lagna" | graha → "15 Ar 23' 12\""
}

export const GOLDEN_TARGET = 50;
export const TOLERANCE_ARCMIN = 1;
export const goldenCases = golden as GoldenCase[];

const ABBR = SIGNS.map((s) => s.slice(0, 2).toLowerCase());

/** "15 Ar 23' 12.5\"" (JH style) → sidereal degrees. */
export function parseJh(s: string): number {
  const m = s.trim().match(/^(\d+)\s*([A-Za-z]{2})\s*(\d+)'\s*(\d+(?:\.\d+)?)"?$/);
  if (!m) throw new Error(`bad position: ${s}`);
  const sign = ABBR.indexOf(m[2]!.toLowerCase());
  if (sign < 0) throw new Error(`bad sign: ${s}`);
  return sign * 30 + Number(m[1]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
}

export const arcmin = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d) * 60;
};

/** Per chart: the worst difference in arcminutes and every position outside tolerance. */
export function compareGolden(c: GoldenCase) {
  const chart = computeChart({ utc: new Date(c.utc), lat: c.lat, lon: c.lon, timeKnown: true });
  let worst = 0;
  const off: string[] = [];
  for (const [key, want] of Object.entries(c.expected)) {
    if (key !== "Lagna" && !GRAHAS.includes(key as never)) throw new Error(`unknown key ${key}`);
    const got = key === "Lagna" ? chart.lagna!.lon : chart.grahas.find((g) => g.graha === key)!.lon;
    const err = arcmin(got, parseJh(want));
    worst = Math.max(worst, err);
    if (err >= TOLERANCE_ARCMIN)
      off.push(`${key}: want ${want}, got ${got.toFixed(4)}° (${err.toFixed(2)}' off)`);
  }
  return { name: c.name, worst, off };
}
