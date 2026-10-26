// Geometry helpers for hand-drawn SVG charts. Designs own all styling.

export type Pt = { x: number; y: number };

export function extent(values: number[], padFrac = 0.08, zero = false): [number, number] {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (zero) lo = Math.min(0, lo);
  const pad = (hi - lo || 1) * padFrac;
  return [zero && lo === 0 ? 0 : lo - pad, hi + pad];
}

export function scale(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
}

/** Round tick values covering [lo, hi]. */
export function ticks(lo: number, hi: number, count = 4): number[] {
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

/** Maps values to points inside a w×h box (index on x). */
export function project(values: number[], w: number, h: number, domain = extent(values)): Pt[] {
  const sx = scale(0, values.length - 1, 0, w);
  const sy = scale(domain[0], domain[1], h, 0);
  return values.map((v, i) => ({ x: sx(i), y: sy(v) }));
}

export function linePath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
}

/** Monotone-ish smooth path (Catmull-Rom → cubic Bézier). */
export function smoothPath(pts: Pt[], tension = 0.5): string {
  if (pts.length < 3) return linePath(pts);
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function areaPath(pts: Pt[], baseY: number, smooth = false): string {
  const top = smooth ? smoothPath(pts) : linePath(pts);
  return `${top}L${pts[pts.length - 1].x},${baseY}L${pts[0].x},${baseY}Z`;
}

export function fmt(v: number, unit?: string): string {
  const n = Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : `${+v.toFixed(v % 1 ? (Math.abs(v) < 10 ? 2 : 1) : 0)}`;
  if (!unit) return n;
  if (unit === "$") return `$${n}`;
  if (unit === "%" || unit === "°C") return `${n}${unit}`;
  return `${n} ${unit}`;
}
