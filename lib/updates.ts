import fs from "node:fs";
import path from "node:path";
import Markdoc from "@markdoc/markdoc";
import YAML from "yaml";

/* Club updates: one Markdown file per post in content/updates/, named YYYY-MM-DD-slug.md, with a small header:
     ---
     title: …
     date: 2026-10-02
     tag: Events          (one word shown as a label)
     summary: …           (one or two sentences for the list, the home page and RSS)
     order: 2             (optional: which same-day post shows first; higher is first)
     ---
   The content editor (/keystatic) writes these too. Newest first. Read at build time, so a new post is live on the next deploy. */
export interface Update { slug: string; title: string; date: string; tag: string; summary: string; order: number; html: string }

const DIR = path.join(process.cwd(), "content", "updates");

// Markdoc, because the editor saves tables as {% table %} tags; plain Markdown (pipe tables included) renders the same as before
const toHtml = (md: string) => Markdoc.renderers.html(Markdoc.transform(Markdoc.parse(md))).replace(/^<article>|<\/article>$/g, "");

export function parseUpdate(file: string, text: string): Update {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing the --- header`);
  let head: Record<string, string>;
  try { head = Object.fromEntries(Object.entries(YAML.parse(m[1]) ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])); }
  catch (e) { throw new Error(`${file}: the --- header isn't valid (${(e as Error).message.split("\n")[0]})`); }
  for (const k of ["title", "date", "summary"]) if (!head[k]) throw new Error(`${file}: the header needs a ${k}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head.date)) throw new Error(`${file}: date must look like 2026-10-02`);
  const slug = file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return { slug, title: head.title, date: head.date, tag: head.tag || "News", summary: head.summary, order: Number(head.order) || 0, html: toHtml(m[2]) };
}

let cache: Update[] | null = null;
export function getUpdates(): Update[] {
  if (cache) return cache;
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".md")) : [];
  cache = files.map((f) => parseUpdate(f, fs.readFileSync(path.join(DIR, f), "utf8"))).sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
  return cache;
}
export const getUpdate = (slug: string) => getUpdates().find((u) => u.slug === slug);
export const updateDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
