import type { FeedItem, Post } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;

const wave = (n: number, base: number, amp: number, seed: number) =>
  Array.from({ length: n }, (_, i) => Math.round((base + amp * Math.sin(i / 2 + seed) + amp * 0.4 * Math.cos(i * 1.3 + seed)) * 10) / 10);

// Each entry is a POST /api/items body as an agent would send it, plus how long ago it arrived.
// Newest first.
const posts: [ago: number, post: Post][] = [
  [2 * MIN, {
    project: "Newsfeed", kind: "milestone", url: "https://github.com/example/newsfeed/pull/12",
    title: "Feed API is live", version: "v0.3.0", body: "Agents can now POST items to /api/items.",
  }],
  [6 * MIN, {
    project: "API", kind: "graph", chart: "line", unit: "ms", url: "https://grafana.example.dev/d/api-latency",
    title: "p95 latency, last 24h",
    series: [
      { name: "p95", points: wave(24, 180, 40, 1).map((y, i) => ({ x: i, y: i === 17 ? 410 : y })) },
      { name: "p50", points: wave(24, 82, 12, 2).map((y, i) => ({ x: i, y })) },
    ],
    note: "Spike at 17:00 traced to a cold cache after deploy.",
    elaboration: `The 17:00 deploy (#418) rolled out a new cache key format, so every edge location started cold at once.

| Window | p95 | Cache hit rate |
| --- | --- | --- |
| 16:00–17:00 | 182 ms | 97% |
| 17:00–17:10 | 410 ms | 41% |
| 17:10–18:00 | 196 ms | 95% |

**What I changed:** deploys now run a warm-up job against the 500 most requested keys before switching traffic. Next deploy is Tuesday; I'll post the latency for it.`,
  }],
  [11 * MIN, {
    project: "Kyoto", kind: "image", src: "/feed/p1018.jpg",
    title: "Day 3: Kurama to Kibune hike", caption: "2.5 hours, mostly shaded. Onsen in Kibune closes at 21:00.", credit: "Unsplash",
    elaboration: `Plan for the day:

1. Eizan line from Demachiyanagi to Kurama, 08:40 train.
2. Kurama-dera, then over the mountain to Kibune (about 2.5 hours with stops).
3. Lunch at Hirobun: *nagashi somen* runs until the end of September, so we'll miss it; their kaiseki is still good.
4. Back via Kibune-guchi, onsen at Kurama on the way.

Bring cash. Neither shrine takes cards.`,
  }],
  [18 * MIN, {
    project: "E-ink scan", kind: "headline",
    title: "Colour e-ink finally hits 300 ppi",
    dek: "Three vendors announced Kaleido 4 panels this week. Prices start at $449.",
    body: "Refresh rates are still below 10 Hz, so it is a reading device, not a dashboard. Battery claims range from 3 to 6 weeks.",
    elaboration: `## The three announcements

- **Boox Note Air 5C**: $449, 10.3", ships in November.
- **PocketBook InkPad Color 4**: €399, 7.8", already in stores in Germany.
- **Bigme B1051C**: $529, 10.3", has a front camera nobody asked for.

> Colour saturation is roughly that of a newspaper insert. Fine for charts, poor for photos.
> — The Verge hands-on

For the kiosk idea it's still a no: even at 10 Hz the feed's takeover transition would ghost badly.`,
  }],
  [24 * MIN, {
    project: "Budget", kind: "metric",
    label: "Cloud spend, October", value: 1284, unit: "$", delta: -12.4, deltaLabel: "vs September",
    spark: [1610, 1540, 1580, 1490, 1450, 1390, 1360, 1300, 1284],
  }],
  [31 * MIN, {
    project: "Newsfeed", kind: "code", url: "https://github.com/example/newsfeed/pull/14",
    title: "Add SSE stream for live updates", file: "src/worker/index.ts", language: "ts", added: 14, removed: 3,
    lines: [
      { t: " ", s: 'app.get("/api/feed", async (c) => {' },
      { t: "-", s: "  const rows = await db.prepare(Q).all();" },
      { t: "-", s: "  return c.json(rows.results);" },
      { t: "+", s: "  return streamSSE(c, async (stream) => {" },
      { t: "+", s: "    for await (const item of feed.subscribe()) {" },
      { t: "+", s: "      await stream.writeSSE({ data: JSON.stringify(item) });" },
      { t: "+", s: "    }" },
      { t: "+", s: "  });" },
      { t: " ", s: "});" },
    ],
  }],
  [52 * MIN, {
    project: "API", kind: "alert", severity: "warning",
    title: "Certificate expires in 9 days", body: "api.example.dev — auto-renew failed twice. DNS challenge timing out.",
  }],
  [70 * MIN, {
    project: "Newsletter", kind: "quote", url: "https://docs.example.com/newsletter-42",
    text: "The best interface is the one you glance at and walk away from, already knowing.",
    source: "Draft intro, paragraph 1",
  }],
  [85 * MIN, {
    project: "Budget", kind: "graph", chart: "bar", unit: "$",
    title: "Spend by category, this week",
    series: [{ name: "Spend", points: [
      { x: "Compute", y: 412 }, { x: "Storage", y: 96 }, { x: "LLM APIs", y: 638 }, { x: "SaaS", y: 210 }, { x: "Domains", y: 24 },
    ] }],
    note: "LLM APIs now 46% of spend.",
  }],
  [102 * MIN, {
    project: "Newsfeed", kind: "progress",
    title: "Building iPad kiosk mode", eta: "~20 min",
    steps: [
      { label: "Scaffold", state: "done" }, { label: "Feed schema", state: "done" }, { label: "SSE stream", state: "active" },
      { label: "Kiosk UI", state: "todo" }, { label: "Deploy", state: "todo" },
    ],
  }],
  [2 * HOUR, {
    project: "E-ink scan", kind: "image", url: "https://www.theverge.com/e-ink-review", src: "/feed/p180.jpg",
    title: "Hands-on with the new colour e-ink slates",
    caption: "Ghosting is mostly gone; colour is muted but legible. Pen latency rivals LCD.",
  }],
  [2.4 * HOUR, {
    project: "API", kind: "log", title: "Deploy #418", url: "https://github.com/example/api/actions/runs/418",
    lines: [
      { at: "14:02:11", level: "info", msg: "build started (commit 9f2c1e)" },
      { at: "14:02:48", level: "ok", msg: "tests passed 212/212" },
      { at: "14:03:05", level: "warn", msg: "bundle 4.8 MB (limit 10 MB)" },
      { at: "14:03:19", level: "ok", msg: "deployed to 312 edge locations" },
      { at: "14:05:40", level: "error", msg: "cache miss storm, p95 410ms" },
      { at: "14:09:02", level: "ok", msg: "recovered" },
    ],
  }],
  [3 * HOUR, {
    project: "Newsletter", kind: "compare",
    title: "Header photo: before / after crop",
    before: { label: "Original", src: "/feed/p299.jpg" }, after: { label: "Proposed", src: "/feed/p274.jpg" },
  }],
  [3.5 * HOUR, {
    project: "Kyoto", kind: "list", title: "Bookings",
    items: [
      { text: "Flights SFO → KIX", done: true }, { text: "JR Pass (7 day)", done: true },
      { text: "Ryokan, nights 5–6", done: false }, { text: "Tea ceremony, Uji", done: false }, { text: "Airport limousine bus", done: true },
    ],
  }],
  [4 * HOUR, {
    project: "E-ink scan", kind: "graph", chart: "area", unit: "k units",
    title: "Weekly e-reader shipments",
    series: [{ name: "Shipments", points: [46, 46, 48, 49, 47, 49, 58, 69, 74, 74, 76, 80].map((y, i) => ({ x: `W${i + 30}`, y })) }],
    note: "Up 74% since late July.",
  }],
  [5 * HOUR, {
    project: "API", kind: "metric",
    label: "Uptime, 30 days", value: 99.982, unit: "%", delta: 0.011, deltaLabel: "vs last month",
    spark: [99.95, 99.97, 99.96, 99.99, 99.98, 99.99, 99.98, 99.982],
  }],
  [6 * HOUR, {
    project: "Budget", kind: "headline",
    title: "Annual Figma renewal can drop to the Starter plan",
    dek: "Only two seats used editor features in the last 90 days. Saves $540/yr.",
  }],
  [7 * HOUR, {
    project: "Newsletter", kind: "image", src: "/feed/p431.jpg",
    title: "Cover candidate", caption: "Warm, quiet, matches the 'slow software' theme.", credit: "Unsplash",
  }],
  [9 * HOUR, {
    project: "Home lab", kind: "alert", severity: "critical",
    title: "NAS disk 3 reporting SMART errors", body: "Reallocated sectors jumped from 0 to 148. Back up /photos before replacing.",
  }],
  [11 * HOUR, {
    project: "Kyoto", kind: "graph", chart: "bar", unit: "°C",
    title: "Forecast highs, Kyoto",
    series: [{ name: "High", points: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x, i) => ({ x, y: [19, 21, 18, 16, 17, 20, 22][i] })) }],
    note: "Rain likely Thursday — swap the Arashiyama day.",
  }],
  [14 * HOUR, {
    project: "Newsfeed", kind: "headline", url: "https://github.com/example/newsfeed/issues/3",
    title: "Chose Server-Sent Events over WebSockets",
    dek: "One-directional, survives iPad sleep better, zero extra infra.",
  }],
];

export const initialFeed: FeedItem[] = posts.map(([ago, post], i) => ({ ...post, id: `i${i + 1}`, at: Date.now() - ago }));

// Posts that "arrive" while the page is open, to show live-update behaviour.
export const incoming: Post[] = [
  { project: "Budget", kind: "metric", label: "LLM API spend today", value: 23.4, unit: "$", delta: 8.1, deltaLabel: "vs avg", spark: [14, 18, 16, 21, 19, 22, 23.4] },
  { project: "E-ink scan", kind: "headline", title: "reMarkable confirms colour model for spring", dek: "Leaked spec sheet matches the Kaleido 4 panel.", url: "https://www.theverge.com/remarkable-colour" },
  { project: "Kyoto", kind: "image", src: "/feed/p1050.jpg", title: "Ine fishing village", caption: "2h45 each way. Boat houses best at golden hour." },
  { project: "API", kind: "graph", chart: "line", unit: "%", title: "Cache hit rate, last hour", url: "https://grafana.example.dev/d/cache",
    series: [{ name: "Hit rate", points: [61, 58, 64, 72, 80, 86, 91, 94, 96, 97.2].map((y, i) => ({ x: `${i * 6}m`, y })) }],
    note: "Back to normal after the warm-up job." },
  { project: "Newsfeed", kind: "progress", title: "Building iPad kiosk mode", eta: "~6 min", steps: [
    { label: "Scaffold", state: "done" }, { label: "Feed schema", state: "done" }, { label: "SSE stream", state: "done" },
    { label: "Kiosk UI", state: "active" }, { label: "Deploy", state: "todo" },
  ] },
  { project: "Newsletter", kind: "quote", text: "Calm technology engages both the center and the periphery of our attention.", source: "Weiser & Brown, 1995" },
];
