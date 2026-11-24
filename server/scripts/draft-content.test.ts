import { expect, test } from "bun:test";
import { CONTENT_KEYS } from "@jyotish/engine";
import { draft } from "./draft-content";

test.each(["en", "hi", "gu"] as const)(
  "%s draft covers every key with filled, non-empty text",
  (lang) => {
    const d = draft(lang);
    expect(Object.keys(d).sort()).toEqual([...CONTENT_KEYS].sort());
    for (const [k, v] of Object.entries(d)) {
      expect([k, v.length > 40]).toEqual([k, true]);
      expect([k, /[{}]|undefined/.test(v)]).toEqual([k, false]);
    }
  },
);

test("classical rules show up in the English draft", () => {
  const d = draft("en");
  expect(d["planet:Sun:sign:Aries"]).toContain("exalted");
  expect(d["planet:Saturn:sign:Aries"]).toContain("debilitated");
  expect(d["planet:Mars:sign:Scorpio"]).toContain("own sign");
  expect(d["planet:Rahu:sign:Taurus"]).not.toMatch(/exalted|debilitated|own sign/); // no node dignity
  expect(d["planet:Saturn:house:11"]).toContain("Natural malefics like Saturn"); // upachaya
  expect(d["planet:Jupiter:house:11"]).not.toContain("malefic");
  expect(d["planet:Venus:house:5"]).toContain("house of fortune"); // trikona
  expect(d["moon:nakshatra:Revati"]).toContain("ruled by Mercury");
  expect(d["lagna:sign:Pisces"]).toContain("Jupiter, the lord of your lagna");
});
