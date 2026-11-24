import type { Chart } from "./chart";

// Ashtakavarga (Parashara): each of the 7 planets receives benefic points (bindus) in the signs that
// are given houses away from each of 8 contributors (the 7 planets and the lagna). Rahu and Ketu
// take no part. Houses are counted from the contributor's sign, 1 = the sign itself.
export const AV_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;
export type AvPlanet = (typeof AV_PLANETS)[number];
type Contributor = AvPlanet | "Lagna";

const TABLE: Record<AvPlanet, Record<Contributor, number[]>> = {
  Sun: {
    Sun: [1, 2, 4, 7, 8, 9, 10, 11], Moon: [3, 6, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [3, 5, 6, 9, 10, 11, 12], Jupiter: [5, 6, 9, 11], Venus: [6, 7, 12],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Lagna: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun: [3, 6, 7, 8, 10, 11], Moon: [1, 3, 6, 7, 10, 11], Mars: [2, 3, 5, 6, 9, 10, 11],
    Mercury: [1, 3, 4, 5, 7, 8, 10, 11], Jupiter: [1, 4, 7, 8, 10, 11, 12],
    Venus: [3, 4, 5, 7, 9, 10, 11], Saturn: [3, 5, 6, 11], Lagna: [3, 6, 10, 11],
  },
  Mars: {
    Sun: [3, 5, 6, 10, 11], Moon: [3, 6, 11], Mars: [1, 2, 4, 7, 8, 10, 11], Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12], Venus: [6, 8, 11, 12], Saturn: [1, 4, 7, 8, 9, 10, 11],
    Lagna: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun: [5, 6, 9, 11, 12], Moon: [2, 4, 6, 8, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [1, 3, 5, 6, 9, 10, 11, 12], Jupiter: [6, 8, 11, 12], Venus: [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11], Lagna: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11], Moon: [2, 5, 7, 9, 11], Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [1, 2, 4, 5, 6, 9, 10, 11], Jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
    Venus: [2, 5, 6, 9, 10, 11], Saturn: [3, 5, 6, 12], Lagna: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun: [8, 11, 12], Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12], Mars: [3, 5, 6, 9, 11, 12],
    Mercury: [3, 5, 6, 9, 11], Jupiter: [5, 8, 9, 10, 11], Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn: [3, 4, 5, 8, 9, 10, 11], Lagna: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun: [1, 2, 4, 7, 8, 10, 11], Moon: [3, 6, 11], Mars: [3, 5, 6, 10, 11, 12],
    Mercury: [6, 8, 9, 10, 11, 12], Jupiter: [5, 6, 11, 12], Venus: [6, 11, 12], Saturn: [3, 5, 6, 11],
    Lagna: [1, 3, 4, 6, 10, 11],
  },
}; // biome-ignore format: table

export interface Ashtakavarga {
  /** Bhinnashtakavarga: bindus per sign (index 0 = Aries) for each planet. */
  bav: Record<AvPlanet, number[]>;
  /** Sarvashtakavarga: sum of the seven per sign; always totals 337. */
  sav: number[];
}

/** Needs the lagna (it is one of the eight contributors), so null when birth time is unknown. */
export function ashtakavarga(chart: Pick<Chart, "lagna" | "grahas">): Ashtakavarga | null {
  if (!chart.lagna) return null;
  const signOf: Record<Contributor, number> = { Lagna: chart.lagna.sign } as Record<
    Contributor,
    number
  >;
  for (const g of chart.grahas)
    if ((AV_PLANETS as readonly string[]).includes(g.graha)) signOf[g.graha as AvPlanet] = g.sign;

  const bav = {} as Record<AvPlanet, number[]>;
  const sav = Array<number>(12).fill(0);
  for (const p of AV_PLANETS) {
    const points = Array<number>(12).fill(0);
    for (const [from, houses] of Object.entries(TABLE[p]) as [Contributor, number[]][]) {
      for (const h of houses) points[(signOf[from] + h - 1) % 12]! += 1;
    }
    bav[p] = points;
    points.forEach((n, s) => {
      sav[s]! += n;
    });
  }
  return { bav, sav };
}
