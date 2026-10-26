import { domainOf, type FeedItem, type ItemOf, type Kind } from "../feed/types";
import { timeAgo } from "../feed/hooks";
import { Chart, Spark } from "./charts";
import { Photo } from "./photo";

export const KIND_LABEL: Record<Kind, string> = {
  headline: "Headline",
  graph: "Chart",
  image: "Photograph",
  metric: "Metric",
  progress: "In progress",
  quote: "Quote",
  code: "Code change",
  alert: "Alert",
  milestone: "Milestone",
  log: "Log",
  compare: "Compare",
  list: "Checklist",
};

/** Metric and progress items pair up side by side as small widgets. */
export const isSmall = (it: FeedItem) => it.kind === "metric" || it.kind === "progress";

export type CardProps = {
  item: FeedItem;
  now: number;
  small?: boolean;
};

/** Topical link for an item; taps go to the link, not the card. */
export function UrlLink({ url, className }: { url: string; className?: string }) {
  return (
    <a className={className ?? "ulink"} href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      {domainOf(url)}
      <span aria-hidden> ↗</span>
    </a>
  );
}

function Meta({ item, now }: { item: FeedItem; now: number }) {
  return (
    <header className="meta">
      <span className="who">{item.project}</span>
      <time>{timeAgo(item.at, now)}</time>
      <span className="spacer" />
      {item.url && <UrlLink url={item.url} />}
    </header>
  );
}

export function Card(p: CardProps) {
  const it = p.item;
  return (
    <article className={`card k-${it.kind}${p.small ? " small" : ""}`}>
      {it.kind !== "milestone" && <Meta item={it} now={p.now} />}
      <Body {...p} />
    </article>
  );
}

function Body(p: CardProps) {
  const it = p.item;
  switch (it.kind) {
    case "headline":
      return (
        <>
          <h2 className="title">{it.title}</h2>
          {it.dek && <p className="dek">{it.dek}</p>}
        </>
      );
    case "graph":
      return (
        <>
          <h3 className="title sm">{it.title}</h3>
          <Chart item={it} size="card" />
          {it.note && <p className="note">{it.note}</p>}
        </>
      );
    case "image":
      return (
        <figure className="pic">
          <Photo src={it.src} alt={it.title ?? it.caption} />
          <figcaption>
            {it.title && <h3 className="title sm">{it.title}</h3>}
            {it.caption && <p className="caption">{it.caption}</p>}
          </figcaption>
        </figure>
      );
    case "metric":
      return <Metric it={it} small={p.small} />;
    case "progress":
      return <Progress it={it} small={p.small} />;
    case "quote":
      return (
        <blockquote className="quote">
          <p>{it.text}</p>
          <cite>{it.source}</cite>
        </blockquote>
      );
    case "code":
      return (
        <>
          <h3 className="title sm">{it.title}</h3>
          <div className="codehead">
            <span className="file">{it.file}</span>
            <span>
              +{it.added} −{it.removed}
            </span>
          </div>
          <pre className="code">
            {it.lines.slice(0, 7).map((l, i) => (
              <div key={i} className={`ln ${l.t === "+" ? "add" : l.t === "-" ? "del" : ""}`}>
                <span className="pm">{l.t === "-" ? "−" : l.t === "+" ? "+" : ""}</span>
                <code>{l.s.replace(/^( +)/, (sp) => " ".repeat(Math.ceil(sp.length / 2))) || " "}</code>
              </div>
            ))}
          </pre>
        </>
      );
    case "alert": {
      const word = { info: "Notice", warning: "Warning", critical: "Critical" }[it.severity];
      return (
        <div className={`alert ${it.severity}`}>
          <span className="sev">{word}</span>
          <h3 className="title sm">{it.title}</h3>
          <p className="body">{it.body}</p>
        </div>
      );
    }
    case "milestone":
      return (
        <div className="milestone">
          <p className="ver">
            <span className="orn">❦</span>
            {it.version && <span>{it.version}</span>}
          </p>
          <h2 className="title">{it.title}</h2>
          {it.body && <p className="dek">{it.body}</p>}
          <p className="mfoot">
            <span>
              {it.project} · {timeAgo(it.at, p.now)}
            </span>
            {it.url && <UrlLink url={it.url} />}
          </p>
        </div>
      );
    case "log": {
      const mark = { info: "·", ok: "✓", warn: "!", error: "×" } as const;
      return (
        <>
          <h3 className="title sm">{it.title}</h3>
          <ol className="log">
            {it.lines.map((l, i) => (
              <li key={i} className={`lv-${l.level}`}>
                <span className="lt">{l.at.slice(0, 5)}</span>
                <span className="lm">{mark[l.level]}</span>
                <span className="lx">{l.msg}</span>
              </li>
            ))}
          </ol>
        </>
      );
    }
    case "compare":
      return (
        <>
          <h3 className="title sm">{it.title}</h3>
          <div className="compare">
            {[it.before, it.after].map((s, i) => (
              <figure key={i}>
                <Photo src={s.src} aspect={4 / 5} alt={s.label} />
                <figcaption>
                  <span className="sc">{i === 0 ? "Before" : "After"}</span> {s.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      );
    case "list": {
      const done = it.items.filter((x) => x.done).length;
      return (
        <>
          <h3 className="title sm">
            {it.title}
            <span className="count">
              {" "}
              {done} of {it.items.length}
            </span>
          </h3>
          <ul className="checks">
            {it.items.map((x, i) => (
              <li key={i} className={x.done ? "done" : ""}>
                <span className="box" aria-hidden>
                  {x.done ? "✓" : ""}
                </span>
                <span>{x.text}</span>
              </li>
            ))}
          </ul>
        </>
      );
    }
  }
}

/* ───────────── kinds with a small variant ───────────── */

export function MetricValue({ it }: { it: ItemOf<"metric"> }) {
  const pre = it.unit === "$" ? "$" : "";
  const post = it.unit && it.unit !== "$" ? it.unit : "";
  return (
    <>
      {pre && <span className="unit pre">{pre}</span>}
      {it.value.toLocaleString("en-US", { maximumFractionDigits: 3 })}
      {post && <span className="unit">{post}</span>}
    </>
  );
}

export function Delta({ it }: { it: ItemOf<"metric"> }) {
  const d = it.delta;
  if (d === undefined) return null;
  return (
    <>
      <span className="arrow">{d < 0 ? "▾" : "▴"}</span>
      {d > 0 ? "+" : "−"}
      {Math.abs(d)}
      {it.unit === "%" ? " pts" : "%"} {it.deltaLabel && <span className="soft">{it.deltaLabel}</span>}
    </>
  );
}

function Metric({ it, small }: { it: ItemOf<"metric">; small?: boolean }) {
  return (
    <div className="metric">
      <p className="mlabel">{it.label}</p>
      <div className="mrow">
        <p className="mval" style={{ ["--len" as string]: it.value.toLocaleString("en-US", { maximumFractionDigits: 3 }).length + (it.unit?.length ?? 0) }}>
          <MetricValue it={it} />
        </p>
        {it.spark && !small && <Spark values={it.spark} />}
      </div>
      {it.delta !== undefined && (
        <p className="mdelta">
          <Delta it={it} />
        </p>
      )}
      {it.spark && small && <Spark values={it.spark} />}
    </div>
  );
}

function Progress({ it, small }: { it: ItemOf<"progress">; small?: boolean }) {
  const done = it.steps.filter((s) => s.state === "done").length;
  const active = it.steps.find((s) => s.state === "active" || s.state === "failed");
  if (small) {
    return (
      <div className="progress-s">
        <h3 className="title xs">{it.title}</h3>
        <ol className="ticks" aria-label={`${done} of ${it.steps.length} steps done`}>
          {it.steps.map((s, i) => (
            <li key={i} className={s.state} />
          ))}
        </ol>
        <p className="psub">
          <b>{active?.label ?? "Done"}</b>
          {it.eta && <> · {it.eta.replace(/^~/, "")} left</>}
        </p>
      </div>
    );
  }
  return (
    <>
      <h3 className="title sm">{it.title}</h3>
      <ol className="steps" style={{ gridTemplateColumns: `repeat(${it.steps.length}, 1fr)` }}>
        {it.steps.map((s, i) => (
          <li key={i} className={`st ${s.state}`}>
            <span className="node" aria-hidden>
              {s.state === "failed" ? "×" : ""}
            </span>
            <span className="slabel">{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="note">
        Step {Math.min(done + 1, it.steps.length)} of {it.steps.length}
        {it.eta && <> · about {it.eta.replace(/^~/, "")} left</>}
      </p>
    </>
  );
}
