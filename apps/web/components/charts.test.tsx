import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { houseOf, NorthChart, SouthChart } from "./charts";

const placements = [
  { label: "Su", sign: 9 }, // Capricorn
  { label: "Ma", sign: 0 }, // Aries
];

const textIn = (html: string, attr: string, value: number) =>
  html.match(new RegExp(`<g ${attr}="${value}">(.*?)</g>`))?.[1] ?? "";

test("houses count from the lagna sign", () => {
  expect(houseOf(0, 0)).toBe(1);
  expect(houseOf(9, 0)).toBe(10);
  expect(houseOf(0, 9)).toBe(4);
});

test("North chart: Aries lagna puts Capricorn Sun in house 10, sign numbers rotate", () => {
  const html = renderToStaticMarkup(
    <NorthChart ascSign={0} ascLabel="Asc" placements={placements} title="D1" />,
  );
  expect(textIn(html, "data-house", 1)).toContain(">Asc  Ma<"); // two labels per line
  expect(textIn(html, "data-house", 1)).toContain(">1<"); // sign number 1 = Aries
  expect(textIn(html, "data-house", 10)).toContain(">Su<");
  expect(textIn(html, "data-house", 10)).toContain(">10<");
});

test("South chart: signs fixed, lagna marked in its sign", () => {
  const html = renderToStaticMarkup(
    <SouthChart ascSign={9} ascLabel="Asc" placements={placements} title="D1" />,
  );
  const capricorn = textIn(html, "data-sign", 9);
  expect(capricorn).toContain(">Asc  Su<");
  expect(capricorn).toContain("<path"); // lagna corner mark
  expect(textIn(html, "data-sign", 0)).toContain(">Ma<");
});

test("unknown birth time: no lagna label or mark", () => {
  const north = renderToStaticMarkup(
    <NorthChart ascSign={0} ascLabel={null} placements={placements} title="D1" />,
  );
  const south = renderToStaticMarkup(
    <SouthChart ascSign={9} ascLabel={null} placements={placements} title="D1" />,
  );
  expect(north).not.toContain("Asc");
  expect(textIn(south, "data-sign", 9)).not.toContain("<path");
});

test("North chart: narrow side houses get one planet per line", () => {
  // Aries lagna: Aquarius (10) is house 11, a side triangle; Taurus (1) is house 2, a top triangle.
  const two = [
    { label: "Me", sign: 10 },
    { label: "Sa", sign: 10 },
    { label: "Ju", sign: 1 },
    { label: "Ve", sign: 1 },
  ];
  const html = renderToStaticMarkup(
    <NorthChart ascSign={0} ascLabel="Asc" placements={two} title="D1" />,
  );
  expect(textIn(html, "data-house", 11)).toContain(">Me<");
  expect(textIn(html, "data-house", 11)).toContain(">Sa<");
  expect(textIn(html, "data-house", 2)).toContain(">Ju  Ve<");
});
