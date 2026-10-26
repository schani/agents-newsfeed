import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { useMemo, type MouseEvent } from "react";

// micromark escapes raw HTML and strips unsafe link protocols by default.
const render = (md: string) => micromark(md, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });

/** Agent-written Markdown, below the full-screen composition. */
export function Elaboration({ md }: { md: string }) {
  const html = useMemo(() => render(md), [md]);
  const onClick = (e: MouseEvent) => {
    const a = (e.target as Element).closest("a");
    if (!a?.href) return;
    e.preventDefault();
    window.open(a.href, "_blank", "noreferrer");
  };
  return (
    <section className="elab" data-keep>
      <span className="orn" aria-hidden>
        ❦
      </span>
      <div className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
