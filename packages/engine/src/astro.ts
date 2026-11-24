import {
  type AstroTime,
  Body,
  Ecliptic,
  EclipticGeoMoon,
  e_tilt,
  GeoVector,
  MakeTime,
  SiderealTime,
} from "astronomy-engine";

export const norm = (deg: number) => ((deg % 360) + 360) % 360;
const rad = Math.PI / 180;

export type Planet = "Sun" | "Moon" | "Mars" | "Mercury" | "Jupiter" | "Venus" | "Saturn";
const BODY: Record<Exclude<Planet, "Moon">, Body> = {
  Sun: Body.Sun,
  Mars: Body.Mars,
  Mercury: Body.Mercury,
  Jupiter: Body.Jupiter,
  Venus: Body.Venus,
  Saturn: Body.Saturn,
};

/** Apparent geocentric longitude, true ecliptic & equinox of date (light-time + aberration corrected). */
export function tropicalLongitude(p: Planet, t: AstroTime): number {
  if (p === "Moon") return EclipticGeoMoon(t).lon;
  return Ecliptic(GeoVector(BODY[p], t, true)).elon;
}

// IAU 1976 general precession in longitude, arcsec (Lieske 1977). T = Julian centuries TT from J2000.
const precession = (T: number) => 5029.0966 * T + 1.11113 * T * T - 0.000006 * T * T * T;

// Lahiri (Swiss Ephemeris SIDM_LAHIRI definition): 23.245524743° at JD 2435553.5 (1956-03-21).
const LAHIRI_T0 = (2435553.5 - 2451545.0) / 36525;
const LAHIRI_AT_T0 = 23.250182778 - 0.004658035;

/** Mean Lahiri ayanamsa in degrees. */
export function lahiriMean(t: AstroTime): number {
  const T = t.tt / 36525;
  return LAHIRI_AT_T0 + (precession(T) - precession(LAHIRI_T0)) / 3600;
}

/**
 * True ayanamsa (mean + nutation in longitude). Subtracting it from a true-of-date longitude gives
 * the same sidereal value Swiss Ephemeris (and so Jagannatha Hora) produce.
 */
export function ayanamsa(t: AstroTime): number {
  return lahiriMean(t) + e_tilt(t).dpsi / 3600;
}

/** Mean lunar node (Rahu), mean equinox of date, Meeus 47.7. */
export function meanNode(t: AstroTime): number {
  const T = t.tt / 36525;
  return norm(
    125.0445479 - 1934.1362891 * T + 0.0020754 * T ** 2 + T ** 3 / 467441 - T ** 4 / 60616000,
  );
}

/** Tropical ascendant (true equinox of date). lon is east-positive. */
export function tropicalAscendant(t: AstroTime, lat: number, lon: number): number {
  const ramc = norm(SiderealTime(t) * 15 + lon) * rad;
  const eps = e_tilt(t).tobl * rad;
  const asc = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat * rad) * Math.sin(eps)),
  );
  return norm(asc / rad);
}

export const time = (d: Date) => MakeTime(d);
