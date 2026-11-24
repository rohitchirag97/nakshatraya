// Content library tool for the astrologer/reviewer (FR-11, FR-16). Runs as the DB owner.
//   bun server/scripts/content.ts status
//   bun server/scripts/content.ts template gu > gu.json     # en, hi or gu; every key, prefilled
//   bun server/scripts/content.ts import hi hi.json "Reviewer Name"
// Only non-empty values are imported; each imported row is marked reviewed by that name, now.
import { content, createDb } from "@jyotish/db";
import { CONTENT_KEYS } from "@jyotish/engine";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { LANGS } from "../src/tenant";

const { db, client } = createDb(process.env.DATABASE_OWNER_URL!);
const [cmd, lang, file, reviewer] = process.argv.slice(2);
const KNOWN = new Set(CONTENT_KEYS);

const checkLang = (l: string | undefined): l is (typeof LANGS)[number] =>
  LANGS.includes(l as (typeof LANGS)[number]);

try {
  if (cmd === "status") {
    for (const l of LANGS) {
      const rows = await db
        .select({ key: content.key })
        .from(content)
        .where(and(eq(content.lang, l), isNotNull(content.reviewedAt)));
      const have = rows.filter((r) => KNOWN.has(r.key)).length;
      console.log(
        `${l}: ${have}/${CONTENT_KEYS.length} reviewed${have === CONTENT_KEYS.length ? " (can go live)" : ""}`,
      );
    }
  } else if (cmd === "template" && checkLang(lang)) {
    const rows = await db.select().from(content).where(eq(content.lang, lang));
    const text = new Map(rows.map((r) => [r.key, r.text]));
    console.log(
      JSON.stringify(Object.fromEntries(CONTENT_KEYS.map((k) => [k, text.get(k) ?? ""])), null, 2),
    );
  } else if (cmd === "import" && checkLang(lang) && file && reviewer) {
    const data: Record<string, unknown> = await Bun.file(file).json();
    const unknown = Object.keys(data).filter((k) => !KNOWN.has(k));
    if (unknown.length) throw new Error(`unknown keys: ${unknown.slice(0, 5).join(", ")}…`);
    const rows = Object.entries(data)
      .filter((e): e is [string, string] => typeof e[1] === "string" && e[1].trim() !== "")
      .map(([key, text]) => ({
        key,
        lang,
        text: text.trim(),
        reviewedBy: reviewer,
        reviewedAt: new Date(),
      }));
    if (rows.length)
      await db
        .insert(content)
        .values(rows)
        .onConflictDoUpdate({
          target: [content.key, content.lang],
          set: {
            text: sql`excluded.text`,
            reviewedBy: sql`excluded.reviewed_by`,
            reviewedAt: sql`excluded.reviewed_at`,
          },
        });
    console.log(`imported ${rows.length} ${lang} entries reviewed by ${reviewer}`);
  } else {
    console.error(
      `usage: status | template <${LANGS.join("|")}> | import <lang> <file.json> "<reviewer>"`,
    );
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
