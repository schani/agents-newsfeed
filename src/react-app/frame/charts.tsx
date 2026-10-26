import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { extent, fmt, linePath, scale, ticks } from "../feed/chart";
import type { ItemOf } from "../feed/types";

type Graph = ItemOf<"graph">;
export type Size = "card" | "full";

/** Measures an element's content box. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (width: number, height: number) =>
      setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: Math.round(width), h: Math.round(height) }));
    set(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** e.g. 0..23 hourly points → "17:00" */
export function xLabel(item: Graph, x: number | string): string {
  if (typeof x === "string") return x;
  return item.series[0].points.length === 24 ? `${String(x).padStart(2, "0")}:00` : String(x);
}

function axisNum(v: number, unit?: string) {
  if (unit === "$") return `$${fmt(v)}`;
  if (unit === "%") return `${fmt(v)}%`;
  if (unit === "°C") return `${fmt(v)}°`;
  return fmt(v);
}

/** Splits a value into prefix / number / suffix so the unit can be typeset smaller. */
export function parts(v: number, unit?: string) {
  const n = fmt(v);
  if (unit === "$") return { pre: "$", num: n, suf: "" };
  if (unit === "%") return { pre: "", num: n, suf: "%" };
  if (unit === "°C") return { pre: "", num: n, suf: "°" };
  return { pre: "", num: n, suf: unit ? ` ${unit}` : "" };
}

/** The single big number a full-screen graph leads with. */
export function takeaway(item: Graph): { v: number; caption: string } {
  const s = item.series[0];
  const pts = s.points;
  if (item.chart === "bar") {
    const top = pts.reduce((a, b) => (b.y > a.y ? b : a));
    const total = pts.reduce((a, b) => a + b.y, 0);
    const share = item.unit === "°C" ? "" : `, ${Math.round((top.y / total) * 100)}% of the total`;
    return { v: top.y, caption: `${xLabel(item, top.x)}, the highest of ${pts.length}${share}` };
  }
  if (item.series.length > 1) {
    const top = pts.reduce((a, b) => (b.y > a.y ? b : a));
    return { v: top.y, caption: `Peak ${s.name} at ${xLabel(item, top.x)}` };
  }
  const ys = pts.map((p) => p.y);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const last = ys[ys.length - 1];
  const where = last === hi ? "the highest" : last === lo ? "the lowest" : "the latest";
  return { v: last, caption: `${xLabel(item, pts[pts.length - 1].x)}, ${where} of ${pts.length} readings. Range ${fmt(lo)} to ${fmt(hi)}.` };
}

const DASH = ["", "7 5"];

/** A 2px ink-line chart drawn in real pixels so type stays legible at any size. */
export function Chart({ item, size }: { item: Graph; size: Size }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  return (
    <div className={`chart chart-${size}`} ref={ref} data-keep={size === "full" ? "" : undefined}>
      {w > 0 && h > 0 && (item.chart === "bar" ? <Bars item={item} w={w} h={h} full={size === "full"} /> : <Lines item={item} w={w} h={h} full={size === "full"} />)}
    </div>
  );
}

function Lines({ item, w, h, full }: { item: Graph; w: number; h: number; full: boolean }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const series = item.series;
  const n = series[0].points.length;
  const multi = series.length > 1;

  const m = full
    ? { l: 58, r: multi ? 132 : 96, t: multi ? 62 : 34, b: 40 }
    : { l: 36, r: multi ? 66 : 46, t: multi ? 38 : 20, b: 24 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const all = series.flatMap((s) => s.points.map((p) => p.y));
  const zero = item.chart === "area" || item.unit === "ms";
  const [lo0, hi0] = extent(all, 0.1, zero);
  const tk = ticks(lo0, hi0, full ? 5 : 3);
  const lo = Math.min(lo0, tk[0]);
  const hi = Math.max(hi0, tk[tk.length - 1]);
  const sx = scale(0, n - 1, m.l, m.l + pw);
  const sy = scale(lo, hi, m.t + ph, m.t);
  const pts = series.map((s) => s.points.map((p, i) => ({ x: sx(i), y: sy(p.y) })));

  const maxLabels = Math.max(2, Math.floor(pw / (full ? 96 : 58)));
  const step = Math.max(1, Math.ceil((n - 1) / (maxLabels - 1)));
  const nice = n === 24 ? (step <= 3 ? 3 : 6) : step;
  const minGap = full ? 84 : 50;
  const xt = series[0].points.map((p, i) => ({ i, p })).filter(({ i }) => i % nice === 0 && (i === n - 1 || sx(n - 1) - sx(i) >= minGap));
  if (xt[xt.length - 1]?.i !== n - 1) xt.push({ i: n - 1, p: series[0].points[n - 1] });

  // Peak annotation on the first series if it stands out.
  const s0 = series[0].points.map((p) => p.y);
  const peakI = s0.indexOf(Math.max(...s0));
  const mean = s0.reduce((a, b) => a + b, 0) / s0.length;
  const showPeak = s0[peakI] > mean * 1.5 && peakI !== n - 1;
  const peakRight = sx(peakI) < m.l + pw - (full ? 150 : 90);

  // Direct end labels, nudged apart if they collide.
  const gapY = full ? 26 : 16;
  const ends = pts.map((p, si) => ({ si, y: p[n - 1].y }));
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < gapY) {
    const mid = (ends[0].y + ends[1].y) / 2;
    const up = ends[0].y < ends[1].y ? 0 : 1;
    ends[up].y = mid - gapY / 2;
    ends[1 - up].y = mid + gapY / 2;
  }

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - m.l) / pw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const lab = full ? 7 : 5;

  return (
    <>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={item.title}
        onPointerDown={full ? onMove : undefined}
        onPointerMove={full ? (e) => e.pointerType === "mouse" && onMove(e) : undefined}
        onPointerLeave={full ? (e) => e.pointerType === "mouse" && setHover(null) : undefined}
      >
        <defs>
          <pattern id={`h${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className="hatch" />
          </pattern>
        </defs>
        {item.unit && !multi && (
          <text x={m.l} y={m.t - (full ? 18 : 10)} className="sc" textAnchor="start">
            {item.unit === "$" ? "USD" : item.unit}
          </text>
        )}
        {multi && (
          <g className="legend" transform={`translate(${m.l}, ${full ? 18 : 10})`}>
            {series.map((s, i) => (
              <g key={s.name} transform={`translate(${i * (full ? 120 : 76)}, 0)`}>
                <line x1="0" x2={full ? 32 : 22} y1="0" y2="0" className="series" strokeDasharray={DASH[i] || undefined} />
                <text x={full ? 42 : 30} y="4" className="sc">
                  {s.name}
                </text>
              </g>
            ))}
            {item.unit && (
              <text x={series.length * (full ? 120 : 76)} y="4" className="sc soft">
                in {item.unit}
              </text>
            )}
          </g>
        )}
        {tk.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + pw} y1={sy(t)} y2={sy(t)} className={t === lo && zero ? "base" : "ref"} />
            <text x={m.l - (full ? 14 : 8)} y={sy(t) + 4} className="num" textAnchor="end">
              {axisNum(t, item.unit)}
            </text>
          </g>
        ))}
        {xt.map(({ i, p }) => (
          <text key={i} x={sx(i)} y={h - (full ? 10 : 5)} className="sc" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
            {xLabel(item, p.x)}
          </text>
        ))}
        {item.chart === "area" && (
          <path d={`${linePath(pts[0])}L${pts[0][n - 1].x},${sy(lo)}L${pts[0][0].x},${sy(lo)}Z`} fill={`url(#h${uid})`} className="area" />
        )}
        {pts.map((p, si) => (
          <path key={si} d={linePath(p)} className="series" strokeDasharray={DASH[si] || undefined} />
        ))}
        {showPeak && (
          <g>
            <circle cx={pts[0][peakI].x} cy={pts[0][peakI].y} r={full ? 5 : 3.5} className="dot" />
            <text
              x={pts[0][peakI].x + (peakRight ? lab + 4 : -(lab + 4))}
              y={pts[0][peakI].y + (full ? 7 : 5)}
              className="lab"
              textAnchor={peakRight ? "start" : "end"}
            >
              {fmt(s0[peakI], item.unit)} peak
            </text>
          </g>
        )}
        {ends.map(({ si, y }) => (
          <g key={si}>
            <circle cx={pts[si][n - 1].x} cy={pts[si][n - 1].y} r={full ? 4 : 3} className="enddot" />
            <text x={m.l + pw + lab + 3} y={y + (full ? 7 : 5)} className="lab">
              {fmt(Math.round(series[si].points[n - 1].y))}
              {multi && <tspan className="lab-sub"> {series[si].name}</tspan>}
            </text>
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={sx(hover)} x2={sx(hover)} y1={m.t} y2={m.t + ph} className="cursor" />
            {pts.map((p, si) => (
              <circle key={si} cx={p[hover].x} cy={p[hover].y} r="5.5" className="dot" />
            ))}
          </g>
        )}
      </svg>
      {full && (
        <p className="readout">
          {hover === null ? (
            <span className="hint">Touch the chart to read values</span>
          ) : (
            <>
              <b>{xLabel(item, series[0].points[hover].x)}</b>
              {series.map((s) => (
                <span key={s.name}>
                  {multi ? `${s.name} ` : ""}
                  <em>{fmt(s.points[hover].y, item.unit)}</em>
                </span>
              ))}
            </>
          )}
        </p>
      )}
    </>
  );
}

function Bars({ item, w, h, full }: { item: Graph; w: number; h: number; full: boolean }) {
  const uid = useId().replace(/:/g, "");
  const s = item.series[0];
  const n = s.points.length;
  const m = full ? { l: 58, r: 8, t: 46, b: 40 } : { l: 36, r: 2, t: 26, b: 24 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const vals = s.points.map((p) => p.y);
  const max = Math.max(...vals);
  const tk = ticks(0, max * 1.1, full ? 4 : 3);
  const hi = Math.max(max * 1.1, tk[tk.length - 1]);
  const sy = scale(0, hi, m.t + ph, m.t);
  const band = pw / n;
  const bw = Math.min(full ? 104 : 44, band * 0.56);
  const valueLabel = (v: number) => (item.unit === "°C" ? `${fmt(v)}°` : fmt(v, item.unit));

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={item.title}>
      <defs>
        <pattern id={`h${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" className="hatch dense" />
        </pattern>
      </defs>
      {item.unit && (
        <text x={m.l} y={full ? 14 : 9} className="sc">
          {item.unit === "$" ? "USD" : item.unit}
        </text>
      )}
      {tk.map((t) =>
        t === 0 ? null : (
          <g key={t}>
            <line x1={m.l} x2={m.l + pw} y1={sy(t)} y2={sy(t)} className="ref" />
            <text x={m.l - (full ? 14 : 8)} y={sy(t) + 4} className="num" textAnchor="end">
              {axisNum(t, item.unit)}
            </text>
          </g>
        ),
      )}
      <text x={m.l - (full ? 14 : 8)} y={sy(0) + 4} className="num" textAnchor="end">
        0
      </text>
      {s.points.map((p, i) => {
        const cx = m.l + band * i + band / 2;
        const top = sy(p.y);
        const isMax = p.y === max;
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={top} width={bw} height={sy(0) - top} className={isMax ? "bar max" : "bar"} fill={isMax ? undefined : `url(#h${uid})`} />
            <text x={cx} y={top - (full ? 12 : 7)} textAnchor="middle" className={isMax ? "lab" : "lab soft"}>
              {valueLabel(p.y)}
            </text>
            <text x={cx} y={h - (full ? 10 : 5)} textAnchor="middle" className="sc">
              {String(p.x)}
            </text>
          </g>
        );
      })}
      <line x1={m.l} x2={m.l + pw} y1={sy(0)} y2={sy(0)} className="base" />
    </svg>
  );
}

/** Small spark line: no labels, a dotted reference at the first value. */
export function Spark({ values }: { values: number[] }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  return (
    <div className="spark" ref={ref} aria-hidden>
      {w > 0 && h > 0 && <SparkSvg values={values} w={w} h={h} />}
    </div>
  );
}

function SparkSvg({ values, w, h }: { values: number[]; w: number; h: number }) {
  const [lo, hi] = extent(values, 0.12);
  const sx = scale(0, values.length - 1, 3, w - 5);
  const sy = scale(lo, hi, h - 4, 4);
  const pts = values.map((v, i) => ({ x: sx(i), y: sy(v) }));
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <line x1="0" x2={w} y1={sy(values[0])} y2={sy(values[0])} className="ref" />
      <path d={linePath(pts)} className="series" />
      <circle cx={last.x} cy={last.y} r="3.5" className="enddot" />
    </svg>
  );
}

/** Large spark for the full-screen metric: direct labels at the first and last reading. */
export function BigSpark({ values, unit }: { values: number[]; unit?: string }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  // Same precision for every label, enough to tell the readings apart.
  const digits = Math.min(3, Math.max(...values.map((v) => (String(v).split(".")[1] ?? "").length)));
  const label = (v: number) => {
    const p = parts(v, unit);
    return `${p.pre}${v.toLocaleString("en-US", { maximumFractionDigits: digits })}${p.suf}`;
  };
  if (!w || !h)
    return <div className="bigspark" ref={ref} aria-hidden />;
  const m = { l: 110, r: 120, t: 34, b: 44 };
  const [lo, hi] = extent(values, 0.08);
  const sx = scale(0, values.length - 1, m.l, w - m.r);
  const sy = scale(lo, hi, h - m.b, m.t);
  const pts = values.map((v, i) => ({ x: sx(i), y: sy(v) }));
  const last = pts[pts.length - 1];
  const first = pts[0];
  return (
    <div className="bigspark" ref={ref} aria-hidden>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <line x1={m.l} x2={w - m.r} y1={first.y} y2={first.y} className="ref" />
        <line x1={m.l} x2={w - m.r} y1={h - 1} y2={h - 1} className="base" />
        <path d={linePath(pts)} className="series" />
        <circle cx={first.x} cy={first.y} r="4" className="dot" />
        <text x={first.x - 16} y={first.y + 7} className="lab soft" textAnchor="end">
          {label(values[0])}
        </text>
        <circle cx={last.x} cy={last.y} r="5" className="enddot" />
        <text x={last.x + 14} y={last.y + 7} className="lab">
          {label(values[values.length - 1])}
        </text>
        <text x={m.l} y={h - 12} className="sc">
          First of {values.length}
        </text>
        <text x={w - m.r} y={h - 12} className="sc" textAnchor="end">
          Now
        </text>
      </svg>
    </div>
  );
}
