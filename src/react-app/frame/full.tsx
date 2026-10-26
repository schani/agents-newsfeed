import type { ReactNode } from "react";
import type { FeedItem, ItemOf } from "../feed/types";
import { BigSpark, Chart, parts, takeaway } from "./charts";
import { Photo } from "./photo";
import { Delta, KIND_LABEL, MetricValue } from "./items";

/* Full-screen compositions, one per kind. Recomposed for portrait in CSS (not scaled). */

type P<K extends FeedItem["kind"]> = { it: ItemOf<K> };

/** Keeps hyphenated words ("e-ink") whole, so balanced display type never breaks at the hyphen. */
function T({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\S+-\S+)/).map((part, i) =>
        i % 2 ? (
          <span key={i} className="nobr">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Kicker({ it, children }: { it: FeedItem; children?: ReactNode }) {
  return (
    <p className="fkick">
      <span>{KIND_LABEL[it.kind]}</span>
      {children}
    </p>
  );
}

function Headline({ it }: P<"headline">) {
  return (
    <div className="fs fs-headline">
      <Kicker it={it} />
      <h1 className="ftitle"><T>{it.title}</T></h1>
      {(it.dek || it.body) && (
        <div className="fcols">
          {it.dek && <p className="fdek">{it.dek}</p>}
          {it.body && <p className="fbody">{it.body}</p>}
        </div>
      )}
    </div>
  );
}

function Graph({ it }: P<"graph">) {
  const t = takeaway(it);
  const p = parts(t.v, it.unit);
  return (
    <div className="fs fs-graph">
      <div className="fg-side">
        <Kicker it={it} />
        <h1 className="ftitle md"><T>{it.title}</T></h1>
        <div className="fg-take">
          <p className="bignum">
            {p.pre && <span className="unit pre">{p.pre}</span>}
            {p.num}
            {p.suf && <span className="unit">{p.suf}</span>}
          </p>
          <p className="fcap">{t.caption}</p>
        </div>
        {it.note && (
          <p className="fnote">
            <span className="sc">Takeaway</span>
            {it.note}
          </p>
        )}
      </div>
      <div className="fg-chart">
        <Chart item={it} size="full" />
      </div>
    </div>
  );
}

function Image({ it }: P<"image">) {
  return (
    <div className="fs fs-image">
      <div className="fi-pic">
        <Photo src={it.src} fill alt={it.title ?? it.caption} />
      </div>
      <div className="fi-text">
        <Kicker it={it} />
        {it.title && <h1 className="ftitle md"><T>{it.title}</T></h1>}
        {it.caption && <p className="fdek">{it.caption}</p>}
        {it.credit && <p className="credit">Via {it.credit}</p>}
      </div>
    </div>
  );
}

function Metric({ it }: P<"metric">) {
  const len = String(it.value.toLocaleString("en-US", { maximumFractionDigits: 3 })).length + (it.unit ? Math.min(2, it.unit.length) : 0);
  return (
    <div className="fs fs-metric">
      <div className="fm-main">
        <Kicker it={it} />
        <h1 className="fm-label">{it.label}</h1>
        <p className="fm-val" style={{ ["--len" as string]: len }}>
          <MetricValue it={it} />
        </p>
        {it.delta !== undefined && (
          <p className="fm-delta">
            <Delta it={it} />
          </p>
        )}
      </div>
      {it.spark && (
        <div className="fm-spark">
          <BigSpark values={it.spark} unit={it.unit} />
        </div>
      )}
    </div>
  );
}

function Progress({ it }: P<"progress">) {
  const done = it.steps.filter((s) => s.state === "done").length;
  const word = { done: "Done", active: "Working", todo: "Queued", failed: "Failed" } as const;
  return (
    <div className="fs fs-progress">
      <div className="fp-head">
        <Kicker it={it} />
        <h1 className="ftitle"><T>{it.title}</T></h1>
        <p className="fp-count">
          <span className="bignum">{done}</span>
          <span className="of">of {it.steps.length} steps done</span>
          {it.eta && <span className="eta">About {it.eta.replace(/^~/, "")} remaining</span>}
        </p>
      </div>
      <ol className="fp-steps" style={{ ["--n" as string]: it.steps.length }}>
        {it.steps.map((s, i) => (
          <li key={i} className={`st ${s.state}`}>
            <span className="node" aria-hidden>
              {s.state === "done" ? "✓" : s.state === "failed" ? "×" : ""}
            </span>
            <span className="slabel">{s.label}</span>
            <span className="sword">{word[s.state]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Quote({ it }: P<"quote">) {
  return (
    <div className="fs fs-quote">
      <Kicker it={it} />
      <blockquote className="quote">
        <p>{it.text}</p>
        <cite>{it.source}</cite>
      </blockquote>
    </div>
  );
}

function Code({ it }: P<"code">) {
  return (
    <div className="fs fs-code">
      <div className="fc-head">
        <Kicker it={it} />
        <h1 className="ftitle md"><T>{it.title}</T></h1>
        <p className="fc-stat">
          <span>
            <b>+{it.added}</b> added
          </span>
          <span>
            <b>−{it.removed}</b> removed
          </span>
        </p>
      </div>
      <div className="fc-sheet">
        <div className="fc-file">
          <span>{it.file}</span>
          <span className="sc">{it.language}</span>
        </div>
        <pre>
          {it.lines.map((l, i) => (
            <div key={i} className={`ln ${l.t === "+" ? "add" : l.t === "-" ? "del" : ""}`}>
              <span className="pm">{l.t === "-" ? "−" : l.t === "+" ? "+" : ""}</span>
              <code>{l.s || " "}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

function Alert({ it }: P<"alert">) {
  const word = { info: "Notice", warning: "Warning", critical: "Critical" }[it.severity];
  return (
    <div className={`fs fs-alert ${it.severity}`}>
      <p className="fa-sev">
        <span className="sev">{word}</span>
        <span className="fa-proj">{it.project}</span>
      </p>
      <h1 className="ftitle"><T>{it.title}</T></h1>
      <p className="fdek">{it.body}</p>
    </div>
  );
}

function Milestone({ it }: P<"milestone">) {
  return (
    <div className="fs fs-milestone">
      <p className="orn" aria-hidden>
        ❦
      </p>
      {it.version && <p className="fv">{it.version}</p>}
      <h1 className="ftitle"><T>{it.title}</T></h1>
      {it.body && <p className="fdek">{it.body}</p>}
    </div>
  );
}

function Log({ it }: P<"log">) {
  const mark = { info: "·", ok: "✓", warn: "!", error: "×" } as const;
  const errors = it.lines.filter((l) => l.level === "error").length;
  return (
    <div className="fs fs-log">
      <div className="fc-head">
        <Kicker it={it} />
        <h1 className="ftitle md"><T>{it.title}</T></h1>
        <p className="fc-stat">
          <span>
            <b>{it.lines.length}</b> lines
          </span>
          <span>
            <b>{errors}</b> {errors === 1 ? "error" : "errors"}
          </span>
        </p>
      </div>
      <ol className="flog">
        {it.lines.map((l, i) => (
          <li key={i} className={`lv-${l.level}`}>
            <span className="lt">{l.at}</span>
            <span className="lm">{mark[l.level]}</span>
            <span className="lx">{l.msg}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Compare({ it }: P<"compare">) {
  return (
    <div className="fs fs-compare">
      <div className="fx-head">
        <Kicker it={it} />
        <h1 className="ftitle md"><T>{it.title}</T></h1>
      </div>
      <div className="fx-pair">
        {[it.before, it.after].map((s, i) => (
          <figure key={i}>
            <div className="fx-pic">
              <Photo src={s.src} fill alt={s.label} />
            </div>
            <figcaption>
              <span className="sc">{i === 0 ? "Before" : "After"}</span> {s.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function List({ it }: P<"list">) {
  const done = it.items.filter((x) => x.done).length;
  return (
    <div className="fs fs-list">
      <div className="fp-head">
        <Kicker it={it} />
        <h1 className="ftitle"><T>{it.title}</T></h1>
        <p className="fp-count">
          <span className="bignum">{done}</span>
          <span className="of">of {it.items.length} done</span>
        </p>
      </div>
      <ul className="fchecks">
        {it.items.map((x, i) => (
          <li key={i} className={x.done ? "done" : ""}>
            <span className="box" aria-hidden>
              {x.done ? "✓" : ""}
            </span>
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Full({ it }: { it: FeedItem }) {
  switch (it.kind) {
    case "headline":
      return <Headline it={it} />;
    case "graph":
      return <Graph it={it} />;
    case "image":
      return <Image it={it} />;
    case "metric":
      return <Metric it={it} />;
    case "progress":
      return <Progress it={it} />;
    case "quote":
      return <Quote it={it} />;
    case "code":
      return <Code it={it} />;
    case "alert":
      return <Alert it={it} />;
    case "milestone":
      return <Milestone it={it} />;
    case "log":
      return <Log it={it} />;
    case "compare":
      return <Compare it={it} />;
    case "list":
      return <List it={it} />;
  }
}
