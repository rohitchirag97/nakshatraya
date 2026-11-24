import {
  ayanamsa,
  lahiriMean,
  meanNode,
  norm,
  type Planet,
  time,
  tropicalAscendant,
  tropicalLongitude,
} from "./astro";
import { type Mahadasha, vimshottari } from "./dasha";

export const ENGINE_VERSION = "0.1.0";

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "PurvaPhalguni",
  "UttaraPhalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "PurvaAshadha",
  "UttaraAshadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "PurvaBhadrapada",
  "UttaraBhadrapada",
  "Revati",
] as const;

export type Graha = Planet | "Rahu" | "Ketu";
export const GRAHAS: Graha[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];

const NAK = 40 / 3; // 13°20'
const BOUNDARY = 0.1; // PRD: flag within 0.1° of a sign or nakshatra edge

export interface Point {
  lon: number; // sidereal, 0..360
  sign: number; // 0 = Aries
  deg: number; // degrees within sign
  nakshatra: number; // 0 = Ashwini
  pada: number; // 1..4
  navamsa: number; // D9 sign, 0 = Aries
  boundary: boolean;
}

export type Dignity = "exalted" | "own" | "debilitated" | null;

export interface GrahaPosition extends Point {
  graha: Graha;
  speed: number; // deg/day
  retrograde: boolean;
  combust: boolean;
  dignity: Dignity;
  house: number | null; // whole-sign, 1..12; null if birth time unknown
}

export interface ChartInput {
  utc: Date;
  lat: number;
  lon: number; // east-positive
  timeKnown: boolean;
}

export interface Chart {
  engineVersion: string;
  input: { utc: string; lat: number; lon: number; timeKnown: boolean; ayanamsa: "lahiri" };
  ayanamsa: number;
  lagna: Point | null;
  grahas: GrahaPosition[];
  dasha: Mahadasha[];
}

const edge = (x: number, step: number) => {
  const r = x % step;
  return Math.min(r, step - r) < BOUNDARY;
};

export function point(lon: number): Point {
  const l = norm(lon);
  const n = Math.floor(l / NAK);
  return {
    lon: l,
    sign: Math.floor(l / 30),
    deg: l % 30,
    nakshatra: n,
    pada: Math.floor((l - n * NAK) / (NAK / 4)) + 1,
    // Each sign has 9 navamsas of 3°20'; counting them continuously from 0° Aries gives the D9 sign.
    navamsa: Math.floor(l / (10 / 3)) % 12,
    boundary: edge(l, 30) || edge(l, NAK),
  };
}

const EXALT: Partial<Record<Graha, number>> = {
  Sun: 0,
  Moon: 1,
  Mars: 9,
  Mercury: 5,
  Jupiter: 3,
  Venus: 11,
  Saturn: 6,
};
const OWN: Partial<Record<Graha, number[]>> = {
  Sun: [4],
  Moon: [3],
  Mars: [0, 7],
  Mercury: [2, 5],
  Jupiter: [8, 11],
  Venus: [1, 6],
  Saturn: [9, 10],
};

// shortcut: no dignity for Rahu/Ketu, schools disagree; add once the astrologer picks one.
export function dignity(g: Graha, sign: number): Dignity {
  const ex = EXALT[g];
  if (ex === undefined) return null;
  if (sign === ex) return "exalted";
  if (sign === (ex + 6) % 12) return "debilitated";
  return OWN[g]?.includes(sign) ? "own" : null;
}

// Classical combustion orbs (degrees from the Sun); Mercury and Venus are tighter when retrograde.
const COMBUST: Partial<Record<Graha, [number, number]>> = {
  Moon: [12, 12],
  Mars: [17, 17],
  Mercury: [14, 12],
  Jupiter: [11, 11],
  Venus: [10, 8],
  Saturn: [15, 15],
};

const arc = (a: number, b: number) => {
  const d = Math.abs(norm(a - b));
  return Math.min(d, 360 - d);
};

const HOUR = 3600_000;

export function computeChart(input: ChartInput): Chart {
  const t = time(input.utc);
  const before = time(new Date(input.utc.getTime() - HOUR));
  const after = time(new Date(input.utc.getTime() + HOUR));
  const ayan = ayanamsa(t);

  const raw = new Map<Graha, { lon: number; speed: number }>();
  for (const p of GRAHAS.slice(0, 7) as Planet[]) {
    const step = norm(tropicalLongitude(p, after) - tropicalLongitude(p, before));
    raw.set(p, {
      lon: tropicalLongitude(p, t) - ayan,
      speed: (step > 180 ? step - 360 : step) * 12,
    });
  }
  // Mean node is on the mean equinox, so it takes the mean ayanamsa.
  const rahu = meanNode(t) - lahiriMean(t);
  const nodeSpeed = -0.0529539; // deg/day, mean node
  raw.set("Rahu", { lon: rahu, speed: nodeSpeed });
  raw.set("Ketu", { lon: rahu + 180, speed: nodeSpeed });

  const lagna = input.timeKnown ? point(tropicalAscendant(t, input.lat, input.lon) - ayan) : null;
  const sun = raw.get("Sun")!.lon;

  const grahas = GRAHAS.map((g): GrahaPosition => {
    const { lon, speed } = raw.get(g)!;
    const pt = point(lon);
    const retrograde = speed < 0;
    const orb = COMBUST[g];
    return {
      graha: g,
      ...pt,
      speed,
      retrograde,
      combust: orb ? arc(lon, sun) <= orb[retrograde ? 1 : 0] : false,
      dignity: dignity(g, pt.sign),
      house: lagna ? ((pt.sign - lagna.sign + 12) % 12) + 1 : null,
    };
  });

  const moon = grahas[1]!;
  return {
    engineVersion: ENGINE_VERSION,
    input: { ...input, utc: input.utc.toISOString(), ayanamsa: "lahiri" },
    ayanamsa: ayan,
    lagna,
    grahas,
    dasha: vimshottari(moon.lon, input.utc),
  };
}
