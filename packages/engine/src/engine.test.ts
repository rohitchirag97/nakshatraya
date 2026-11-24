import { describe, expect, test } from "bun:test";
import { Body, Observer, SearchAltitude, SunPosition } from "astronomy-engine";
import { lahiriMean, meanNode, time, tropicalAscendant } from "./astro";
import { computeChart, dignity, point } from "./chart";
import { currentDasha, vimshottari, YEAR_MS } from "./dasha";
import { toUtc } from "./time";

describe("astronomy against published values", () => {
  test("Lahiri ayanamsa at J2000 = 23°51'25.5\"", () => {
    const v = lahiriMean(time(new Date("2000-01-01T12:00:00Z")));
    expect(Math.abs(v - (23 + 51 / 60 + 25.5 / 3600)) * 3600).toBeLessThan(1);
  });

  test("mean node, Meeus example 22.a (1987-04-10 0h TD) = 11.2531°", () => {
    const t = time(new Date("1987-04-10T00:00:00Z"));
    const td = time(new Date(Date.UTC(1987, 3, 10) - (t.tt - t.ut) * 86400_000));
    expect(meanNode(td)).toBeCloseTo(11.2531, 3);
  });

  // Independent check of sidereal time, longitude sign and latitude: at sunrise the Sun is on the ascendant.
  test.each([
    [28.61, 77.21],
    [13.08, 80.27],
    [-33.87, 151.21],
  ])("ascendant = Sun longitude at sunrise (%p, %p)", (lat, lon) => {
    const t = SearchAltitude(
      Body.Sun,
      new Observer(lat, lon, 0),
      1,
      new Date("2026-06-01Z"),
      2,
      0,
    )!;
    expect(Math.abs(tropicalAscendant(t, lat, lon) - SunPosition(t).elon) * 60).toBeLessThan(1);
  });
});

describe("chart points", () => {
  test("nakshatra, pada, navamsa", () => {
    expect(point(0)).toMatchObject({ sign: 0, nakshatra: 0, pada: 1, navamsa: 0 });
    expect(point(13.3)).toMatchObject({ nakshatra: 0, pada: 4 });
    expect(point(30.5).navamsa).toBe(9); // Taurus 0° → Capricorn navamsa
    expect(point(60.5).navamsa).toBe(6); // Gemini 0° → Libra
    expect(point(359.9)).toMatchObject({ sign: 11, nakshatra: 26, pada: 4, navamsa: 11 });
  });

  test("boundary flag within 0.1° of sign or nakshatra edge", () => {
    expect(point(29.95).boundary).toBe(true);
    expect(point(30.05).boundary).toBe(true);
    expect(point(40 / 3 + 0.05).boundary).toBe(true);
    expect(point(20).boundary).toBe(false);
  });

  test("dignity", () => {
    expect(dignity("Sun", 0)).toBe("exalted");
    expect(dignity("Sun", 6)).toBe("debilitated");
    expect(dignity("Mercury", 5)).toBe("exalted"); // exaltation wins over own sign
    expect(dignity("Mars", 7)).toBe("own");
    expect(dignity("Rahu", 1)).toBeNull();
  });
});

describe("vimshottari", () => {
  const birth = new Date("1990-01-01T00:00:00Z");

  test("Moon at 0° Aries → full Ketu dasha starting at birth", () => {
    const d = vimshottari(0, birth);
    expect(d[0]).toMatchObject({ lord: "Ketu", start: birth.toISOString() });
    expect(d.map((m) => m.lord)).toEqual([
      "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
    ]); // biome-ignore format: list
  });

  test("periods are contiguous, total 120 years, antardashas fill each mahadasha", () => {
    const d = vimshottari(123.4, birth);
    expect(Date.parse(d[8]!.end) - Date.parse(d[0]!.start)).toBeCloseTo(120 * YEAR_MS, -3);
    for (let i = 0; i < 9; i++) {
      const md = d[i]!;
      if (i) expect(md.start).toBe(d[i - 1]!.end);
      expect(md.antardashas[0]!.lord).toBe(md.lord);
      expect(md.antardashas[0]!.start).toBe(md.start);
      expect(Math.abs(Date.parse(md.antardashas[8]!.end) - Date.parse(md.end))).toBeLessThan(2);
    }
  });

  test("half-way through a Venus nakshatra → 10 years of Venus left", () => {
    const d = vimshottari(40 / 3 + 20 / 3, birth); // middle of Bharani
    expect(d[0]!.lord).toBe("Venus");
    expect((Date.parse(d[0]!.end) - birth.getTime()) / YEAR_MS).toBeCloseTo(10, 6);
  });

  test("currentDasha", () => {
    const d = vimshottari(0, birth);
    const cur = currentDasha(d, new Date("1990-02-01Z"));
    expect(cur?.md.lord).toBe("Ketu");
    expect(cur?.ad?.lord).toBe("Ketu");
  });
});

describe("local time → UTC", () => {
  test("IST +5:30", () => {
    expect(toUtc("1985-06-15T10:00", "Asia/Kolkata").toISOString()).toBe(
      "1985-06-15T04:30:00.000Z",
    );
  });
  test("war time +6:30 (1943)", () => {
    expect(toUtc("1943-06-15T10:00", "Asia/Kolkata").toISOString()).toBe(
      "1943-06-15T03:30:00.000Z",
    );
  });
  test("rejects bad input", () => {
    expect(() => toUtc("1985-13-40T10:00", "Asia/Kolkata")).toThrow();
    expect(() => toUtc("1985-06-15T10:00", "Nowhere/City")).toThrow();
  });
});

describe("computeChart", () => {
  const input = { utc: new Date("1990-01-01T06:30:00Z"), lat: 28.61, lon: 77.21, timeKnown: true };

  test("shape and invariants", () => {
    const c = computeChart(input);
    expect(c.grahas).toHaveLength(9);
    const g = Object.fromEntries(c.grahas.map((x) => [x.graha, x]));
    expect(Math.abs(g.Ketu!.lon - ((g.Rahu!.lon + 180) % 360))).toBeLessThan(1e-9);
    expect(g.Sun!.retrograde || g.Moon!.retrograde).toBe(false);
    expect(g.Rahu!.retrograde && g.Ketu!.retrograde).toBe(true);
    expect(g.Sun!.house).toBe(((g.Sun!.sign - c.lagna!.sign + 12) % 12) + 1);
    expect(g.Sun!.combust).toBe(false);
    expect(JSON.parse(JSON.stringify(c))).toEqual(c); // storable as result_json
  });

  test("unknown birth time drops lagna and houses", () => {
    const c = computeChart({ ...input, timeKnown: false });
    expect(c.lagna).toBeNull();
    expect(c.grahas.every((g) => g.house === null)).toBe(true);
  });

  test("deterministic", () => {
    expect(computeChart(input)).toEqual(computeChart(input));
  });

  test("under 50 ms", () => {
    computeChart(input); // warm up
    const t = performance.now();
    for (let i = 0; i < 20; i++)
      computeChart({ ...input, utc: new Date(input.utc.getTime() + i * 1e9) });
    expect((performance.now() - t) / 20).toBeLessThan(50);
  });
});
