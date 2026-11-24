import { expect, test } from "bun:test";
import en from "./en.json";
import gu from "./gu.json";
import hi from "./hi.json";

/** { a: { b: "x" } } → { "a.b": "x" } */
const flat = (o: object, p = ""): Record<string, string> =>
  Object.fromEntries(
    Object.entries(o).flatMap(([k, v]) =>
      typeof v === "object" ? Object.entries(flat(v, `${p}${k}.`)) : [[`${p}${k}`, String(v)]],
    ),
  );
const placeholders = (s = "") => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test.each([
  ["hi", hi],
  ["gu", gu],
])("%s has exactly the English keys and placeholders", (_, msgs) => {
  const e = flat(en);
  const m = flat(msgs);
  expect(Object.keys(m).sort()).toEqual(Object.keys(e).sort());
  for (const k of Object.keys(e)) expect([k, placeholders(m[k])]).toEqual([k, placeholders(e[k])]);
});
