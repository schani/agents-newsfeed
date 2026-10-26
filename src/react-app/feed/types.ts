// The feed's data model. `Post` is exactly what agents send to POST /api/items
// (see agent-skill/SKILL.md); the server adds `id` and `at`.

export type Series = { name: string; points: { x: number | string; y: number }[] };

export type Body =
  | { kind: "headline"; title: string; dek?: string; body?: string }
  | { kind: "graph"; title: string; chart: "line" | "area" | "bar"; unit?: string; series: Series[]; note?: string }
  | { kind: "image"; src: string; title?: string; caption?: string; credit?: string }
  | { kind: "metric"; label: string; value: number; unit?: string; delta?: number; deltaLabel?: string; spark?: number[] }
  | { kind: "progress"; title: string; steps: { label: string; state: "done" | "active" | "todo" | "failed" }[]; eta?: string }
  | { kind: "quote"; text: string; source: string }
  | { kind: "code"; title: string; file: string; language: string; added: number; removed: number; lines: { t: "+" | "-" | " "; s: string }[] }
  | { kind: "alert"; severity: "info" | "warning" | "critical"; title: string; body: string }
  | { kind: "milestone"; title: string; body?: string; version?: string }
  | { kind: "log"; title: string; lines: { at: string; level: "info" | "warn" | "error" | "ok"; msg: string }[] }
  | { kind: "compare"; title: string; before: { label: string; src: string }; after: { label: string; src: string } }
  | { kind: "list"; title: string; items: { text: string; done: boolean }[] };

/** What an agent posts. `elaboration` is Markdown, shown only full screen. */
export type Post = { project: string; url?: string; elaboration?: string } & Body;

/** What the feed serves. */
export type FeedItem = Post & { id: string; at: number };

export type Kind = FeedItem["kind"];
export type ItemOf<K extends Kind> = Extract<FeedItem, { kind: K }>;

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
