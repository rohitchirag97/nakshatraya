export type DashaLord =
  | "Ketu"
  | "Venus"
  | "Sun"
  | "Moon"
  | "Mars"
  | "Rahu"
  | "Jupiter"
  | "Saturn"
  | "Mercury";

const ORDER: [DashaLord, number][] = [
  ["Ketu", 7],
  ["Venus", 20],
  ["Sun", 6],
  ["Moon", 10],
  ["Mars", 7],
  ["Rahu", 18],
  ["Jupiter", 16],
  ["Saturn", 19],
  ["Mercury", 17],
];

// shortcut: 365.25-day year; Jagannatha Hora's default may differ, the golden-set dasha dates will tell.
export const YEAR_MS = 365.25 * 86400_000;
const NAK = 40 / 3;

export interface Period {
  lord: DashaLord;
  start: string; // ISO
  end: string;
}
export interface Mahadasha extends Period {
  antardashas: Period[];
}

/** Vimshottari from the Moon's sidereal longitude. The first mahadasha starts before birth (its elapsed part). */
export function vimshottari(moonLon: number, birth: Date): Mahadasha[] {
  const nak = Math.floor(moonLon / NAK);
  const elapsed = (moonLon - nak * NAK) / NAK;
  const first = nak % 9;
  let start = birth.getTime() - elapsed * ORDER[first]![1] * YEAR_MS;

  const out: Mahadasha[] = [];
  for (let i = 0; i < 9; i++) {
    const [lord, years] = ORDER[(first + i) % 9]!;
    const mdStart = start;
    const antardashas: Period[] = [];
    let s = mdStart;
    for (let j = 0; j < 9; j++) {
      const [sub, subYears] = ORDER[(first + i + j) % 9]!;
      const e = s + ((years * subYears) / 120) * YEAR_MS;
      antardashas.push({ lord: sub, start: iso(s), end: iso(e) });
      s = e;
    }
    start = mdStart + years * YEAR_MS;
    out.push({ lord, start: iso(mdStart), end: iso(start), antardashas });
  }
  return out;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** The mahadasha and antardasha running at `at`, for highlighting. */
export function currentDasha(dashas: Mahadasha[], at: Date) {
  const t = at.toISOString();
  const md = dashas.find((d) => d.start <= t && t < d.end);
  return md ? { md, ad: md.antardashas.find((d) => d.start <= t && t < d.end) } : null;
}
