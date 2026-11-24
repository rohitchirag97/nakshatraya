// D1/D9 chart drawings as inline SVG, so they print crisply and use the page's Noto fonts.
// Drawn on aged, crumpled paper with lotus-petal ornaments, like a hand-made janam kundli.

export interface Placement {
  label: string; // already translated, e.g. "Ma" / "मं", with retrograde mark
  sign: number; // 0 = Aries
}

interface ChartProps {
  ascSign: number; // sign in house 1
  ascLabel: string | null; // null when birth time is unknown (chart drawn from the Moon's sign)
  placements: Placement[];
  title: string; // short, e.g. "D1"; drawn in the South chart's centre
  fontSize?: number; // label size in chart units (400 = chart width); bigger for small charts
  markAsc?: boolean; // South chart's lagna corner mark; defaults to "has an ascLabel"
}

const S = 400;
const FONT = 15;
const M = 16; // ornamental border band around the 400×400 chart
const VIEW = `${-M} ${-M} ${S + 2 * M} ${S + 2 * M}`;

/** `n` lotus petals around (cx, cy), from angle `from` to `to` (degrees), each `len` long. */
function petals(cx: number, cy: number, len: number, n: number, from = 0, to = 360, w = 0.38) {
  const full = to - from >= 360;
  const step = (to - from) / (full ? n : n - 1);
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = ((from + i * step) * Math.PI) / 180;
    const [dx, dy, px, py] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)];
    const [tx, ty] = [cx + dx * len, cy + dy * len];
    const [mx, my] = [cx + dx * len * 0.45, cy + dy * len * 0.45];
    const k = len * w;
    const f = (v: number) => v.toFixed(1);
    d += `M${f(cx)} ${f(cy)}Q${f(mx + px * k)} ${f(my + py * k)} ${f(tx)} ${f(ty)}Q${f(mx - px * k)} ${f(my - py * k)} ${f(cx)} ${f(cy)}Z`;
  }
  return d;
}

/** Lotus rosette: outer petals, inner petals offset between them, a seed circle. */
function Lotus({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g className="chart-orn">
      <path d={petals(cx, cy, r, 8)} className="petal" />
      <path d={petals(cx, cy, r * 0.62, 8, 22.5, 382.5)} className="petal-in" />
      <circle cx={cx} cy={cy} r={r * 0.16} className="seed" />
    </g>
  );
}

/** Quarter-lotus fans in the four corners, pointing into the chart. */
function CornerFans({ r = 30 }: { r?: number }) {
  const at: [number, number, number][] = [
    [0, 0, 0], [S, 0, 90], [S, S, 180], [0, S, 270],
  ]; // biome-ignore format: table
  return (
    <g className="chart-orn">
      {at.map(([x, y, a]) => (
        <path key={a} d={petals(x, y, r, 4, a + 8, a + 82, 0.42)} className="petal" />
      ))}
    </g>
  );
}

/**
 * Crumpled old paper and a double border with dots. The paper is a baked JPEG (an SVG
 * feTurbulence + feDiffuseLighting render): a live filter is rasterised per chart and made
 * each PDF ~6 MB, while one image is stored once per PDF.
 */
function Paper() {
  const o = -M;
  const W = S + 2 * M;
  const dots = [];
  for (let i = 0; i <= 20; i++) {
    const v = (S * i) / 20;
    dots.push([v, -M / 2], [v, S + M / 2], [-M / 2, v], [S + M / 2, v]);
  }
  return (
    <>
      <image href="/paper.jpg" x={o} y={o} width={W} height={W} preserveAspectRatio="none" />
      <g className="chart-frame">
        <rect x={o + 3} y={o + 3} width={W - 6} height={W - 6} rx={4} strokeWidth={1} />
        <rect x={0} y={0} width={S} height={S} strokeWidth={2.2} />
      </g>
      <g className="chart-dots">
        {dots.map(([x, y]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={1.6} />
        ))}
      </g>
    </>
  );
}

// North Indian: houses are fixed, signs rotate. [planet centre, sign-number position] per house 1..12.
const NORTH: [number, number, number, number][] = [
  [200, 95, 200, 182], [100, 42, 100, 86], [40, 100, 84, 100], [100, 200, 182, 200],
  [40, 300, 84, 300], [100, 358, 100, 314], [200, 305, 200, 222], [300, 358, 300, 314],
  [360, 300, 316, 300], [300, 200, 218, 200], [360, 100, 316, 100], [300, 42, 300, 86],
]; // biome-ignore format: table

// Left/right triangles of the North chart: tall but narrow, so one label per line.
const SIDE_HOUSES = [3, 5, 9, 11];

export const houseOf = (sign: number, ascSign: number) => ((sign - ascSign + 12) % 12) + 1;

/** Labels `perLine` to a line: 2 where there's width, 1 in the narrow side triangles. */
function Stack({
  x,
  y,
  lines: labels,
  perLine = 2,
  size = FONT,
}: {
  x: number;
  y: number;
  lines: string[];
  perLine?: number;
  size?: number;
}) {
  const lines: string[] = [];
  for (let i = 0; i < labels.length; i += perLine)
    lines.push(labels.slice(i, i + perLine).join("  "));
  const top = y - ((lines.length - 1) * (size + 2)) / 2;
  return (
    <>
      {lines.map((l, i) => (
        <text
          key={l}
          x={x}
          y={top + i * (size + 2)}
          fontSize={size}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {l}
        </text>
      ))}
    </>
  );
}

export function NorthChart({ ascSign, ascLabel, placements, title, fontSize = FONT }: ChartProps) {
  return (
    <svg viewBox={VIEW} role="img" aria-label={title} className="chart">
      <Paper />
      <CornerFans />
      {/* Diamond edges bow inward, so the four kendra houses read as lotus petals. */}
      <path
        d={`M0 0L${S} ${S}M${S} 0L0 ${S}M200 0Q260 140 400 200Q260 260 200 400Q140 260 0 200Q140 140 200 0Z`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Lotus cx={200} cy={200} r={11} />
      {NORTH.map(([cx, cy, nx, ny], i) => {
        const house = i + 1;
        const sign = (ascSign + i) % 12;
        const lines = placements
          .filter((p) => houseOf(p.sign, ascSign) === house)
          .map((p) => p.label);
        return (
          <g key={house} data-house={house}>
            <text
              x={nx}
              y={ny}
              fontSize={Math.min(Math.round(fontSize * 0.8), 17)} // stays small beside big labels
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={0.6}
            >
              {sign + 1}
            </text>
            <Stack
              x={cx}
              y={cy}
              lines={house === 1 && ascLabel ? [ascLabel, ...lines] : lines}
              perLine={SIDE_HOUSES.includes(house) ? 1 : 2}
              size={fontSize}
            />
          </g>
        );
      })}
    </svg>
  );
}

// South Indian: signs are fixed (Pisces top-left, clockwise), the lagna is marked. [col, row] per sign.
const SOUTH: [number, number][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0],
]; // biome-ignore format: table

export function SouthChart({
  ascSign,
  ascLabel,
  placements,
  title,
  fontSize = FONT,
  markAsc = !!ascLabel,
}: ChartProps) {
  const cell = S / 4;
  return (
    <svg viewBox={VIEW} role="img" aria-label={title} className="chart">
      <Paper />
      <Lotus cx={S / 2} cy={S / 2} r={70} />
      {SOUTH.map(([col, row], sign) => {
        const x = col * cell;
        const y = row * cell;
        const lines = placements.filter((p) => p.sign === sign).map((p) => p.label);
        return (
          <g key={sign} data-sign={sign}>
            <rect
              x={x}
              y={y}
              width={cell}
              height={cell}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
            {sign === ascSign && markAsc && (
              <path d={`M${x} ${y + 22}L${x + 22} ${y}`} stroke="currentColor" strokeWidth={1.5} />
            )}
            <Stack
              x={x + cell / 2}
              y={y + cell / 2}
              lines={sign === ascSign && ascLabel ? [ascLabel, ...lines] : lines}
              size={fontSize}
            />
          </g>
        );
      })}
      <circle cx={S / 2} cy={S / 2} r={20} className="chart-title-bg" />
      <text
        x={S / 2}
        y={S / 2}
        fontSize={18}
        textAnchor="middle"
        dominantBaseline="middle"
        className="chart-title"
      >
        {title}
      </text>
    </svg>
  );
}
