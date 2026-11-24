// PRD: only permissive licences. Fails CI on anything not in the allowlist (e.g. GPL, AGPL, unknown).
import { readdirSync } from "node:fs";

const ALLOWED = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "Unlicense",
  "Python-2.0",
  "CC-BY-4.0",
]);

// "(MIT OR Apache-2.0)" passes if any OR-branch has only allowed parts.
export const allowed = (expr: string) =>
  expr
    .replace(/[()]/g, "")
    .split(/\s+OR\s+/i)
    .some((alt) => alt.split(/\s+AND\s+/i).every((id) => ALLOWED.has(id.trim())));

// A package root is node_modules/<name>/package.json or node_modules/@scope/<name>/package.json.
const PKG = /(^|\/)node_modules\/(@[^/]+\/)?[^/.@][^/]*\/package\.json$/;

if (import.meta.main) {
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const rel of readdirSync("node_modules", { recursive: true, encoding: "utf8" })) {
    const path = `node_modules/${rel}`;
    if (!PKG.test(path)) continue;
    const pkg = await Bun.file(path).json();
    const id = `${pkg.name}@${pkg.version}`;
    if (!pkg.name || !pkg.version || seen.has(id)) continue;
    seen.add(id);
    const lic: string | undefined =
      typeof pkg.license === "string"
        ? pkg.license
        : (pkg.license?.type ?? pkg.licenses?.map((l: { type: string }) => l.type).join(" OR "));
    if (!lic || !allowed(lic)) bad.push(`${id}: ${lic ?? "none"}`);
  }

  if (bad.length) {
    console.error(`Disallowed licences:\n${bad.join("\n")}`);
    process.exit(1);
  }
  console.log(`${seen.size} packages, all permissive`);
}
