// GeoNames (CC-BY 4.0, credit "GeoNames.org"): cities15000.txt + admin1CodesASCII.txt from
// https://download.geonames.org/export/dump/
// Import with import-geonames.ts. This file is runtime-neutral so the Worker can use searchPlaces.
import { desc, ilike, or, sql } from "drizzle-orm";
import type { Db } from "./index";
import { places } from "./schema";

export type Place = typeof places.$inferInsert;

/** admin1CodesASCII.txt: "IN.16\tMaharashtra\tMaharashtra\t1264418" → Map("IN.16" → "Maharashtra"). */
export function parseAdmin1(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of text.split("\n")) {
    const [code, name] = line.split("\t");
    if (code && name) m.set(code, name);
  }
  return m;
}

/** One cities15000.txt row (19 tab-separated columns) → place. */
export function parseCity(line: string, admin1: Map<string, string>): Place | null {
  const f = line.split("\t");
  if (f.length < 19) return null;
  const [id, name, ascii, alt, lat, lon] = f;
  const country = f[8]!;
  const names = new Set((alt ?? "").split(",").filter(Boolean));
  if (ascii && ascii !== name) names.add(ascii);
  return {
    id: Number(id),
    name: name!,
    altNames: [...names],
    admin1: admin1.get(`${country}.${f[10]}`) ?? null,
    country,
    lat: Number(lat),
    lon: Number(lon),
    tz: f[17]!,
    population: Number(f[14]),
  };
}

/** Prefix search on name and alternate names (any script), biggest places first. */
export function searchPlaces(db: Db["db"], q: string, limit = 10) {
  const like = `${q.replace(/[\\%_]/g, "\\$&")}%`;
  // shortcut: unnest scan over ~30k rows is a few ms; add a trigram index if it shows up in profiles.
  return (
    db
      .select()
      .from(places)
      .where(
        or(
          ilike(places.name, like),
          sql`exists (select 1 from unnest(${places.altNames}) a where a ilike ${like})`,
        ),
      )
      // Own-name matches before other-language alternates ("Khe" → Kheda, not Kyiv), then India
      // (most customers are Indian), then bigger places.
      .orderBy(
        desc(sql`${places.name} ilike ${like}`),
        desc(sql`${places.country} = 'IN'`),
        desc(places.population),
      )
      .limit(limit)
  );
}
