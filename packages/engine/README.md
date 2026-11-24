# @jyotish/engine

Pure TypeScript, no I/O. `computeChart({ utc, lat, lon, timeKnown })` → sidereal (Lahiri) grahas, lagna,
whole-sign houses, D9 (`navamsa` on each point) and Vimshottari dasha. `toUtc(local, zone)` converts birth
wall-clock time with historical tzdata. Bump `ENGINE_VERSION` in `src/chart.ts` whenever output can change.

## Choices to confirm against Jagannatha Hora

- Ayanamsa: Lahiri as defined by Swiss Ephemeris, true (mean + nutation)
- Rahu/Ketu: **mean** node
- Dasha year: 365.25 days
- Positions: geocentric, apparent

## Golden set (PRD accuracy gate)

Add 50 charts (1900–2050, Indian cities) to `src/golden.json`, read from Jagannatha Hora with the
settings above. Positions are written the way JH shows them:

```json
[
  {
    "name": "Delhi 1985-06-15 10:00 IST",
    "utc": "1985-06-15T04:30:00Z",
    "lat": 28.6139,
    "lon": 77.209,
    "expected": {
      "Lagna": "12 Le 34' 56\"",
      "Sun": "0 Ge 12' 3\"",
      "Moon": "...", "Mars": "...", "Mercury": "...", "Jupiter": "...",
      "Venus": "...", "Saturn": "...", "Rahu": "...", "Ketu": "..."
    }
  }
]
```

`bun test packages/engine` fails any position more than 1 arcminute off and lists it. Until there are
50 charts, the gate shows as a todo.
