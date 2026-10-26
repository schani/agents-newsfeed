import type { Post } from "../react-app/feed/types.js";

// Checks a posted item against the schema in skill.ts. Throws `Invalid` with a message an agent can act on.

export class Invalid extends Error {}

type Check = (v: unknown, path: string) => void;

const fail = (path: string, msg: string): never => {
  throw new Invalid(`${path}: ${msg}`);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const str: Check = (v, p) => {
  if (typeof v !== "string" || !v.trim()) fail(p, "expected a non-empty string");
};
const num: Check = (v, p) => {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(p, "expected a number");
};
const bool: Check = (v, p) => {
  if (typeof v !== "boolean") fail(p, "expected a boolean");
};
const oneOf =
  (...vals: (string | number)[]): Check =>
  (v, p) => {
    if (!vals.includes(v as string)) fail(p, `expected one of ${vals.map((x) => JSON.stringify(x)).join(", ")}`);
  };
const strOrNum: Check = (v, p) => {
  if (typeof v !== "string" && (typeof v !== "number" || !Number.isFinite(v))) fail(p, "expected a string or number");
};
const url: Check = (v, p) => {
  str(v, p);
  if (!/^https?:\/\//.test(v as string)) fail(p, "expected an http(s) URL");
};
const image: Check = (v, p) => {
  str(v, p);
  if (!/^(https?:\/\/|data:image\/)/.test(v as string)) fail(p, "expected an https:// or data:image/ URL");
};
const opt =
  (c: Check): Check =>
  (v, p) => {
    if (v !== undefined && v !== null) c(v, p);
  };
const arr =
  (c: Check, min = 1, max = 500): Check =>
  (v, p) => {
    if (!Array.isArray(v)) return fail(p, "expected an array");
    if (v.length < min || v.length > max) fail(p, `expected ${min}–${max} entries`);
    v.forEach((x, i) => c(x, `${p}[${i}]`));
  };
const obj =
  (shape: Record<string, Check>): Check =>
  (v, p) => {
    if (!isObj(v)) return fail(p, "expected an object");
    for (const [k, c] of Object.entries(shape)) c(v[k], `${p}.${k}`);
  };

const series = obj({ name: str, points: arr(obj({ x: strOrNum, y: num }), 1, 500) });
const shot = obj({ label: str, src: image });

const kinds: Record<Post["kind"], Record<string, Check>> = {
  headline: { title: str, dek: opt(str), body: opt(str) },
  graph: { title: str, chart: oneOf("line", "area", "bar"), unit: opt(str), series: arr(series, 1, 2), note: opt(str) },
  image: { src: image, title: opt(str), caption: opt(str), credit: opt(str) },
  metric: { label: str, value: num, unit: opt(str), delta: opt(num), deltaLabel: opt(str), spark: opt(arr(num, 2, 200)) },
  progress: { title: str, steps: arr(obj({ label: str, state: oneOf("done", "active", "todo", "failed") }), 1, 20), eta: opt(str) },
  quote: { text: str, source: str },
  code: {
    title: str,
    file: str,
    language: str,
    added: num,
    removed: num,
    lines: arr(obj({ t: oneOf("+", "-", " "), s: (v, p) => typeof v === "string" || fail(p, "expected a string") }), 1, 60),
  },
  alert: { severity: oneOf("info", "warning", "critical"), title: str, body: str },
  milestone: { title: str, body: opt(str), version: opt(str) },
  log: { title: str, lines: arr(obj({ at: str, level: oneOf("info", "warn", "error", "ok"), msg: str }), 1, 100) },
  compare: { title: str, before: shot, after: shot },
  list: { title: str, items: arr(obj({ text: str, done: bool }), 1, 50) },
};

/** Returns the post with only known fields, or throws `Invalid`. */
export function validate(body: unknown): Post {
  if (!isObj(body)) throw new Invalid("body: expected a JSON object");
  str(body.project, "project");
  if ((body.project as string).length > 40) fail("project", "keep it to one or two words");
  const shape = kinds[body.kind as Post["kind"]];
  if (!shape) fail("kind", `expected one of ${Object.keys(kinds).join(", ")}`);
  opt(url)(body.url, "url");
  opt(str)(body.elaboration, "elaboration");
  if (typeof body.elaboration === "string" && body.elaboration.length > 20_000) fail("elaboration", "keep it under 20,000 characters");
  obj(shape)(body, "item");
  const out: Record<string, unknown> = { project: body.project, kind: body.kind };
  if (body.url) out.url = body.url;
  if (body.elaboration) out.elaboration = body.elaboration;
  for (const k of Object.keys(shape)) if (body[k] !== undefined && body[k] !== null) out[k] = body[k];
  return out as Post;
}
