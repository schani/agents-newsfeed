import { useCallback, useEffect, useRef, useState } from "react";
import { incoming, initialFeed } from "./mock";
import type { FeedItem } from "./types";

const params = new URLSearchParams(location.search);
// ?demo shows the sample feed, with a new item every 25s (?every=N to change, ?live=0 to freeze).
const DEMO = params.has("demo");
const LIVE = params.get("live") !== "0";
const EVERY = Number(params.get("every") ?? 25) * 1000;
const POLL = 10_000;

export type Feed =
  | { status: "loading" | "signed-out" }
  | { status: "ready"; items: FeedItem[]; remove: (id: string) => void };

/** The feed, newest first, kept fresh by polling. */
export function useFeed(): Feed {
  const [items, setItems] = useState<FeedItem[] | null>(DEMO ? initialFeed : null);
  const [signedOut, setSignedOut] = useState(false);
  const deleted = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/items");
      if (res.status === 401) return setSignedOut(true);
      if (!res.ok) return;
      const all = (await res.json()) as FeedItem[];
      setItems(all.filter((it) => !deleted.current.has(it.id)));
    } catch {
      // Offline or asleep; the next poll catches up.
    }
  }, []);

  useEffect(() => {
    if (DEMO) {
      if (!LIVE) return;
      let n = 0;
      const t = setInterval(() => {
        const next = incoming[n % incoming.length];
        n++;
        setItems((cur) => [{ ...next, id: `live-${n}`, at: Date.now() } as FeedItem, ...(cur ?? [])]);
      }, EVERY);
      return () => clearInterval(t);
    }
    load();
    const t = setInterval(load, POLL);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const remove = useCallback(
    (id: string) => {
      deleted.current.add(id);
      setItems((cur) => cur?.filter((it) => it.id !== id) ?? cur);
      if (DEMO) return;
      const restore = () => {
        deleted.current.delete(id);
        load();
      };
      fetch(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) => r.ok || restore(), restore);
    },
    [load],
  );

  if (signedOut) return { status: "signed-out" };
  if (!items) return { status: "loading" };
  return { status: "ready", items, remove };
}

/** Re-renders every `ms` and returns the current time. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Injects a stylesheet <link> (e.g. Google Fonts) once. */
export function useFonts(href: string) {
  useEffect(() => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }, [href]);
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
