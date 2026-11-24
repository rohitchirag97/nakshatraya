// Decorative zodiac wheel: 12 rashi sectors, 27 nakshatra ticks, 108 pada marks, a sun at the centre.
// Pure geometry (no glyph fonts), drawn in currentColor so each surface tints it.
const C = 200;
const at = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};
const line = (deg: number, r1: number, r2: number) => {
  const [x1, y1] = at(deg, r1);
  const [x2, y2] = at(deg, r2);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const SECTORS = Array.from({ length: 12 }, (_, i) => line(i * 30, 112, 184)).join("");
const NAKSHATRAS = Array.from({ length: 27 }, (_, i) => line(i * (360 / 27), 184, 197)).join("");
const PADAS = Array.from({ length: 108 }, (_, i) => line(i * (360 / 108), 190, 197)).join("");
const RAYS = Array.from({ length: 12 }, (_, i) => line(i * 30 + 15, 30, 52)).join("");
const GEMS = Array.from({ length: 12 }, (_, i) => at(i * 30 + 15, 167));
const PLANETS = [20, 75, 118, 160, 205, 248, 290, 318, 342].map((d, i) => at(d, 128 + (i % 3) * 9));

export function Wheel({ className = "wheel" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
    >
      <circle cx={C} cy={C} r={197} strokeWidth={1.2} />
      <circle cx={C} cy={C} r={184} strokeWidth={0.8} />
      <circle cx={C} cy={C} r={150} strokeWidth={0.5} strokeDasharray="2 4" />
      <circle cx={C} cy={C} r={112} strokeWidth={0.9} />
      <circle cx={C} cy={C} r={70} strokeWidth={0.5} />
      <path d={SECTORS} strokeWidth={0.8} />
      <path d={NAKSHATRAS} strokeWidth={1.2} />
      <path d={PADAS} strokeWidth={0.4} />
      <path d={RAYS} strokeWidth={1} />
      <circle cx={C} cy={C} r={22} fill="currentColor" fillOpacity={0.35} strokeWidth={1} />
      {GEMS.map(([x, y]) => (
        <path
          key={`${x},${y}`}
          d={`M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`}
          fill="currentColor"
          fillOpacity={0.5}
          strokeWidth={0}
        />
      ))}
      {PLANETS.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={3.2} fill="currentColor" strokeWidth={0} />
      ))}
    </svg>
  );
}
