import { expect, test } from "bun:test";
import { parseAdmin1, parseCity } from "./geonames";

const admin1 = parseAdmin1(
  "IN.16\tMaharashtra\tMaharashtra\t1264418\nIN.34\tBihar\tBihar\t1275715\n",
);
const row = [
  "1278149", "Aurangabad", "Aurangabad", "Aurangabad,औरंगाबाद,அவுரங்காபாத்", "19.87757", "75.34226",
  "P", "PPLA2", "IN", "", "16", "", "", "", "1016441", "", "581", "Asia/Kolkata", "2023-01-01",
].join("\t"); // biome-ignore format: row

test("parses a GeoNames city row with Indic alternate names and state", () => {
  expect(parseCity(row, admin1)).toEqual({
    id: 1278149,
    name: "Aurangabad",
    altNames: ["Aurangabad", "औरंगाबाद", "அவுரங்காபாத்"],
    admin1: "Maharashtra",
    country: "IN",
    lat: 19.87757,
    lon: 75.34226,
    tz: "Asia/Kolkata",
    population: 1016441,
  });
});

test("skips blank or short lines", () => {
  expect(parseCity("", admin1)).toBeNull();
  expect(parseCity("1\tx", admin1)).toBeNull();
});
