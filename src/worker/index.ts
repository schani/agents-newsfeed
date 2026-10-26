import { app, auth, db, migrate, secrets, storage } from "flingit";
import type { Context } from "hono";
import type { FeedItem, Post } from "../react-app/feed/types.js";
import { skill } from "./skill.js";
import { Invalid, validate } from "./validate.js";

auth.allow({ domains: ["heyglide.com"] });

migrate("001_items", async () => {
  await db.prepare("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, at INTEGER NOT NULL, post TEXT NOT NULL)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_items_at ON items(at)").run();
});

const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif" };

function bearerOk(c: Context): boolean {
  const got = new TextEncoder().encode(c.req.header("Authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const want = new TextEncoder().encode(secrets.get("API_KEY"));
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

/** Moves inline data: images into storage and points the item at them. */
async function storeImages(id: string, post: Post): Promise<Post> {
  let n = 0;
  const store = async (src: string, path: string): Promise<string> => {
    const m = src.match(/^data:(image\/[\w+.-]+);base64,(.*)$/s);
    if (!m) {
      if (src.startsWith("data:")) throw new Invalid(`${path}: expected a base64 data:image/ URL`);
      return src;
    }
    const ext = IMAGE_TYPES[m[1]];
    if (!ext) throw new Invalid(`${path}: unsupported image type ${m[1]}`);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(m[2].replace(/\s/g, "")), (ch) => ch.charCodeAt(0));
    } catch {
      throw new Invalid(`${path}: invalid base64`);
    }
    if (bytes.length > MAX_IMAGE) throw new Invalid(`${path}: image larger than 5 MB`);
    const key = `items/${id}/${n++}.${ext}`;
    await storage.put(key, bytes, { contentType: m[1] });
    return `/api/images/${key}`;
  };
  switch (post.kind) {
    case "image":
      return { ...post, src: await store(post.src, "src") };
    case "compare":
      return {
        ...post,
        before: { ...post.before, src: await store(post.before.src, "before.src") },
        after: { ...post.after, src: await store(post.after.src, "after.src") },
      };
    default:
      return post;
  }
}

async function deleteImages(id: string) {
  const { objects } = await storage.list({ prefix: `items/${id}/` });
  await Promise.all(objects.map((o) => storage.delete(o.key)));
}

// Agents post here with the API key.
app.post("/api/items", async (c) => {
  if (!bearerOk(c)) return c.json({ error: "invalid or missing bearer token" }, 401);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "body: expected JSON" }, 400);
  }
  const id = crypto.randomUUID();
  try {
    const post = await storeImages(id, validate(body));
    await db.prepare("INSERT INTO items (id, at, post) VALUES (?, ?, ?)").bind(id, Date.now(), JSON.stringify(post)).run();
  } catch (e) {
    if (e instanceof Invalid) {
      await deleteImages(id);
      return c.json({ error: e.message }, 400);
    }
    throw e;
  }
  return c.json({ id }, 201);
});

// Everything below is for the signed-in feed.
app.get("/api/me", auth.require(), async (c) => c.json(await auth.user(c)));

app.get("/api/items", auth.require(), async (c) => {
  const { results } = await db.prepare("SELECT id, at, post FROM items ORDER BY at DESC LIMIT 300").all<{ id: string; at: number; post: string }>();
  const items: FeedItem[] = results.map((r) => ({ ...(JSON.parse(r.post) as Post), id: r.id, at: r.at }));
  return c.json(items);
});

app.delete("/api/items/:id", auth.require(), async (c) => {
  const id = c.req.param("id");
  await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  await deleteImages(id);
  return c.body(null, 204);
});

app.get("/api/images/*", auth.require(), async (c) => {
  const file = await storage.get(c.req.path.slice("/api/images/".length));
  if (!file) return c.text("Not found", 404);
  return new Response(file.body, {
    headers: { "Content-Type": file.contentType ?? "application/octet-stream", "Cache-Control": "private, max-age=31536000, immutable" },
  });
});

app.get("/SKILL.md", (c) => c.text(skill(new URL(c.req.url).origin), 200, { "Content-Type": "text/markdown; charset=utf-8" }));
