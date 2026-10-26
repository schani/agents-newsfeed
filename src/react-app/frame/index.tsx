import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { timeAgo, useFeed, useFonts, useNow } from "../feed/hooks";
import type { FeedItem } from "../feed/types";
import { useSize } from "./charts";
import { Elaboration } from "./elaboration";
import { Full } from "./full";
import { Card, KIND_LABEL, UrlLink, isSmall } from "./items";
import "./frame.css";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";

const params = new URLSearchParams(location.search);
/** How long a takeover holds the screen; `?hold=N` overrides (seconds). */
const HOLD = Math.max(2, Number(params.get("hold") ?? 60)) * 1000;
/** The countdown hairline steps down in this many discrete increments. */
const STEPS = 12;

/* ───────────── takeover state: what is on screen, and what is waiting ───────────── */

type Show = { id: string; start: number; end: number; why: "arrival" | "tap" };
type TState = { show: Show | null; queue: string[] };
type TAction =
  | { type: "arrive"; ids: string[]; now: number }
  | { type: "open"; id: string; now: number }
  | { type: "next"; now: number }
  | { type: "dismiss" }
  | { type: "hold" }
  | { type: "remove"; id: string; now: number };

/** Arrivals hold the screen for HOLD; items opened by hand stay until dismissed. */
const showFor = (id: string, now: number, why: Show["why"]): Show => ({ id, start: now, end: why === "tap" ? Infinity : now + HOLD, why });

/* ───────────── URLs: /item/<id> while an item is full screen ───────────── */

const itemPath = (id: string) => `/item/${encodeURIComponent(id)}${location.search}`;
const feedPath = () => `/${location.search}`;
function idFromPath(): string | null {
  const m = location.pathname.match(/^\/item\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function takeover(s: TState, a: TAction): TState {
  switch (a.type) {
    case "arrive": {
      const queue = [...s.queue, ...a.ids];
      if (s.show) return { ...s, queue };
      return { show: showFor(queue[0], a.now, "arrival"), queue: queue.slice(1) };
    }
    case "open":
      return { ...s, show: showFor(a.id, a.now, "tap") };
    case "next":
      if (!s.queue.length) return { show: null, queue: [] };
      return { show: showFor(s.queue[0], a.now, "arrival"), queue: s.queue.slice(1) };
    case "dismiss":
      return { show: null, queue: [] };
    case "hold":
      return s.show ? { ...s, show: { ...s.show, end: Infinity } } : s;
    case "remove": {
      const queue = s.queue.filter((id) => id !== a.id);
      if (s.show?.id !== a.id) return { ...s, queue };
      return takeover({ show: s.show, queue }, { type: "next", now: a.now });
    }
  }
}

/* ───────────── masonry ───────────── */

type Unit = { ids: string[]; pair: boolean };

/** Small widgets (metric, progress) pair up side by side, as in Ambient Glass. */
function units(items: FeedItem[]): Unit[] {
  const out: Unit[] = [];
  let open: Unit | null = null;
  let openAt = 0;
  for (const it of items) {
    if (isSmall(it)) {
      if (open && out.length - openAt <= 8) {
        open.ids.push(it.id);
        open.pair = true;
        open = null;
      } else {
        open = { ids: [it.id], pair: false };
        openAt = out.length;
        out.push(open);
      }
    } else out.push({ ids: [it.id], pair: false });
  }
  return out;
}

function Masonry({
  items,
  width,
  render,
  onOpen,
}: {
  items: FeedItem[];
  width: number;
  render: (it: FeedItem, small: boolean) => ReactNode;
  onOpen: (id: string) => void;
}) {
  const cols = width >= 880 ? 3 : 2;
  const gap = cols === 3 ? 48 : 44;
  const vgap = 58;
  const colW = Math.floor((width - gap * (cols - 1)) / cols);
  const els = useRef(new Map<string, HTMLElement>());
  const [heights, setHeights] = useState<Record<string, number>>({});
  const heightsRef = useRef(heights);
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const list = useMemo(() => units(items), [items]);

  const measure = useCallback(() => {
    let changed = false;
    const next = { ...heightsRef.current };
    els.current.forEach((el, key) => {
      const h = el.offsetHeight;
      if (Math.abs((next[key] ?? -1) - h) > 0.5) {
        next[key] = h;
        changed = true;
      }
    });
    if (changed) {
      heightsRef.current = next;
      setHeights(next);
    }
  }, []);

  // Measure before paint, so a new layout is never shown half-settled.
  useLayoutEffect(measure);

  useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    els.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [list, colW, measure]);

  const colH = Array<number>(cols).fill(0);
  const placed = list.map((u) => {
    const key = u.ids.join("+");
    const h = heights[key] ?? 300;
    let c = 0;
    for (let k = 1; k < cols; k++) if (colH[k] < colH[c] - 1) c = k;
    const p = { ...u, key, x: c * (colW + gap), y: colH[c], first: colH[c] === 0 };
    colH[c] += h + vgap;
    return p;
  });
  const total = Math.max(0, ...colH) - vgap;

  const onClick = (id: string) => (e: MouseEvent) => {
    if ((e.target as Element).closest("button, a, input")) return;
    onOpen(id);
  };
  const onKey = (id: string) => (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(id);
    }
  };

  return (
    <div className="mas" style={{ height: total, ["--gap" as string]: `${gap}px`, ["--vgap" as string]: `${vgap}px` }}>
      {Array.from({ length: cols - 1 }, (_, i) => (
        <i key={i} className="colrule" style={{ left: (i + 1) * (colW + gap) - gap / 2 }} aria-hidden />
      ))}
      {placed.map((p) => (
        <div
          key={p.ids[0]}
          className={`cell${p.pair ? " pair" : ""}${p.first ? " first" : ""}`}
          ref={(el) => {
            if (el) els.current.set(p.key, el);
            else els.current.delete(p.key);
          }}
          style={{ width: colW, transform: `translate(${p.x}px, ${p.y}px)` }}
        >
          {p.ids.map((id) => {
            const it = byId[id];
            return (
              <div
                key={id}
                className="tap"
                data-id={id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${KIND_LABEL[it.kind].toLowerCase()} from ${it.project} full screen`}
                onClick={onClick(id)}
                onKeyDown={onKey(id)}
              >
                {render(it, p.pair)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ───────────── the full-screen takeover ───────────── */

function Takeover({
  item,
  show,
  more,
  now,
  onNext,
  onDismiss,
  onDelete,
  onHold,
}: {
  item: FeedItem;
  show: Show;
  more: number;
  now: number;
  onNext: () => void;
  onDismiss: () => void;
  onDelete: () => void;
  onHold: () => void;
}) {
  const span = show.end - show.start;
  const stepMs = span / STEPS;
  const remainingStep = () => Math.max(0, Math.ceil((show.end - Date.now()) / stepMs - 1e-6));
  const [left, setLeft] = useState(remainingStep);
  useEffect(() => {
    setLeft(remainingStep());
    const t = setInterval(() => setLeft(remainingStep()), Math.min(500, stepMs / 2));
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.end, show.start]);

  const elab = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, [show.id]);

  const onBg = (e: MouseEvent) => {
    if ((e.target as Element).closest("button, a, input, [data-keep]")) return;
    onDismiss();
  };

  return (
    <div
      ref={root}
      className={`takeover t-${item.kind}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${KIND_LABEL[item.kind]} from ${item.project}`}
      tabIndex={-1}
      onClick={onBg}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss();
        if (e.key === "ArrowRight" && more) onNext();
      }}
    >
      <header className="tbar">
        <p className="tmeta">
          <span className="who">{item.project}</span>
          <span className="when">{timeAgo(item.at, now)}</span>
        </p>
        <span className="spacer" />
        <DeleteButton onDelete={onDelete} />
        {item.url && <UrlLink url={item.url} className="tbtn" />}
        {more > 0 && (
          <button type="button" className="tbtn" onClick={onNext}>
            {more} more <span aria-hidden>›</span>
          </button>
        )}
        <button type="button" className="tbtn back" onClick={onDismiss}>
          <span aria-hidden>‹</span> Back to feed
        </button>
      </header>
      <div className="tline" aria-hidden>
        <i style={{ width: show.end === Infinity ? 0 : `${(left / STEPS) * 100}%` }} />
      </div>
      {/* Reading the elaboration holds the item on screen until dismissed. */}
      <main className="tscroll" onScroll={(e) => e.currentTarget.scrollTop > 8 && show.end !== Infinity && onHold()}>
        <div className="tbody">
          <Full it={item} />
          {item.elaboration && (
            <button type="button" className="tbtn more" onClick={() => elab.current?.scrollIntoView({ behavior: "smooth" })}>
              Read more <span aria-hidden>↓</span>
            </button>
          )}
        </div>
        {item.elaboration && (
          <div ref={elab}>
            <Elaboration md={item.elaboration} />
          </div>
        )}
      </main>
    </div>
  );
}

/* ───────────── root ───────────── */

function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const t = setTimeout(finish, 2200);
    const link = document.querySelector<HTMLLinkElement>(`link[href="${FONTS}"]`);
    const loadFaces = () =>
      Promise.all(["400 16px Newsreader", "italic 400 16px Newsreader", "300 16px Newsreader", "400 16px 'Source Sans 3'", "600 16px 'Source Sans 3'"].map((f) => document.fonts.load(f)))
        .then(finish, finish);
    if (link?.sheet) loadFaces();
    else link?.addEventListener("load", loadFaces, { once: true });
    return () => clearTimeout(t);
  }, []);
  return ready;
}

export default function App() {
  useFonts(FONTS);
  const fontsReady = useFontsReady();
  const feed = useFeed();
  if (feed.status !== "ready")
    return <div className={`d-frame${fontsReady ? " ready" : ""}`}>{feed.status === "signed-out" && <SignIn />}</div>;
  return <FeedView items={feed.items} remove={feed.remove} fontsReady={fontsReady} />;
}

function FeedView({ items, remove, fontsReady }: { items: FeedItem[]; remove: (id: string) => void; fontsReady: boolean }) {
  const now = useNow(30_000);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i] as const)), [items]);
  const [t, dispatch] = useReducer(takeover, null, () => {
    const id = idFromPath();
    return { show: id && items.some((i) => i.id === id) ? showFor(id, Date.now(), "tap") : null, queue: [] };
  });
  const scroller = useRef<HTMLDivElement>(null);
  const [feedRef, { w: width }] = useSize<HTMLDivElement>();

  // Anything not in the initial load is an arrival: it takes over the screen, then sits at the top of the feed.
  const [initial] = useState(() => new Set(items.map((i) => i.id)));
  const seen = useRef(new Set(initial));
  useLayoutEffect(() => {
    const ids = items.filter((i) => !seen.current.has(i.id)).map((i) => i.id);
    if (!ids.length) return;
    ids.forEach((id) => seen.current.add(id));
    // Same commit as the feed update: the overlay is up before the masonry reshuffle can paint.
    dispatch({ type: "arrive", ids: ids.reverse(), now: Date.now() });
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [items]);

  const show = t.show;
  useEffect(() => {
    if (!show || show.end === Infinity) return;
    const id = setTimeout(() => dispatch({ type: "next", now: Date.now() }), Math.max(0, show.end - Date.now()));
    return () => clearTimeout(id);
  }, [show]);

  // Keep the URL on what's shown. Opening by hand adds a history entry, so the browser's back button
  // returns to the feed; arrivals only replace the current entry.
  const shownId = show?.id ?? null;
  const why = show?.why;
  useEffect(() => {
    const cur = idFromPath();
    if (shownId === cur) return;
    if (shownId) {
      if (why === "tap" && !cur) history.pushState({ pushed: true }, "", itemPath(shownId));
      else history.replaceState(history.state, "", itemPath(shownId));
    } else if (history.state?.pushed) history.back();
    else history.replaceState(null, "", feedPath());
  }, [shownId, why]);
  useEffect(() => {
    const onPop = () => {
      const id = idFromPath();
      dispatch(id ? { type: "open", id, now: Date.now() } : { type: "dismiss" });
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  // e-ink refresh flash on every swap (not on first load).
  const swapKey = show ? `${show.id}@${show.start}` : "feed";
  const swaps = useRef<{ key: string; n: number }>({ key: swapKey, n: 0 });
  if (swaps.current.key !== swapKey) swaps.current = { key: swapKey, n: swaps.current.n + 1 };

  const open = useCallback((id: string) => dispatch({ type: "open", id, now: Date.now() }), []);

  const render = (it: FeedItem, small: boolean) => (
    <Card item={it} now={now} small={small} />
  );

  const shown = show ? byId.get(show.id) : undefined;

  return (
    <div className={`d-frame${fontsReady ? " ready" : ""}`}>
      <div className="scroller" ref={scroller} inert={!!shown} aria-hidden={shown ? true : undefined}>
        {items.length ? (
          <>
            <div className="feed" ref={feedRef}>
              {width > 0 && <Masonry items={items} width={width} render={render} onOpen={open} />}
            </div>
            <p className="end">
              <span className="orn" aria-hidden>
                ❦
              </span>
              That is everything.
            </p>
          </>
        ) : (
          <div className="empty" ref={feedRef}>
            <span className="orn" aria-hidden>
              ❦
            </span>
            <p>No news yet.</p>
            <p className="soft">
              Agents learn to post here from <a href="/SKILL.md">{location.host}/SKILL.md</a>
            </p>
          </div>
        )}
      </div>

      {show && shown && (
        <Takeover
          key={`${show.id}@${show.start}`}
          item={shown}
          show={show}
          more={t.queue.length}
          now={now}
          onNext={() => dispatch({ type: "next", now: Date.now() })}
          onDismiss={() => dispatch({ type: "dismiss" })}
          onHold={() => dispatch({ type: "hold" })}
          onDelete={() => {
            remove(shown.id);
            dispatch({ type: "remove", id: shown.id, now: Date.now() });
          }}
        />
      )}
      {swaps.current.n > 0 && <div key={swaps.current.n} className="refresh" aria-hidden />}
    </div>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={armed ? "tbtn del armed" : "tbtn del"} onClick={() => (armed ? onDelete() : setArmed(true))}>
      {armed ? "Tap again to delete" : "Delete"}
    </button>
  );
}

function SignIn() {
  const denied = new URLSearchParams(location.search).has("auth_error");
  return (
    <div className="signin">
      <span className="orn" aria-hidden>
        ❦
      </span>
      <h1>Agent News</h1>
      <a className="tbtn" href="/api/auth/signin/google?redirect=/">
        Sign in with Google
      </a>
      <p className="soft">{denied ? "That account is not allowed. Use your heyglide.com account." : "For heyglide.com accounts."}</p>
    </div>
  );
}
