import { content, type Db } from "@jyotish/db";
import { CONTENT_KEYS } from "@jyotish/engine";
import { and, eq, isNotNull } from "drizzle-orm";

/** Reviewed text for a language, plus the catalogue keys it still lacks (FR-16). */
export async function reviewedText(db: Db["db"], lang: string) {
  const rows = await db
    .select({ key: content.key, text: content.text })
    .from(content)
    .where(and(eq(content.lang, lang), isNotNull(content.reviewedAt)));
  const text = new Map(rows.map((r) => [r.key, r.text]));
  return { text, missing: CONTENT_KEYS.filter((k) => !text.has(k)) };
}
