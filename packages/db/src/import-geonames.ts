// Usage: DATABASE_URL=$DATABASE_OWNER_URL bun packages/db/src/import-geonames.ts <dir with both files>
import { sql } from "drizzle-orm";
import { type Place, parseAdmin1, parseCity } from "./geonames";
import { createDb, places } from "./index";

const dir = process.argv[2];
if (!dir) throw new Error("usage: bun packages/db/src/geonames.ts <dir>");
const { db, client } = createDb(process.env.DATABASE_URL!);
const admin1 = parseAdmin1(await Bun.file(`${dir}/admin1CodesASCII.txt`).text());
const rows = (await Bun.file(`${dir}/cities15000.txt`).text())
  .split("\n")
  .map((l) => parseCity(l, admin1))
  .filter((p): p is Place => p !== null);
for (let i = 0; i < rows.length; i += 1000) {
  await db
    .insert(places)
    .values(rows.slice(i, i + 1000))
    .onConflictDoUpdate({
      target: places.id,
      set: {
        name: sql`excluded.name`,
        altNames: sql`excluded.alt_names`,
        admin1: sql`excluded.admin1`,
        lat: sql`excluded.lat`,
        lon: sql`excluded.lon`,
        tz: sql`excluded.tz`,
        population: sql`excluded.population`,
      },
    });
}
console.log(`imported ${rows.length} places`);
await client.end();
