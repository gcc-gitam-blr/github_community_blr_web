/* Error reports from visitors' browsers: what the reporter sends, what /api/errors keeps, and how /admin groups them.
   Only the message, a trimmed stack, the page path and the browser family. Emails, query strings, link
   fragments (sign-in tokens live there) and ids in paths are removed before anything leaves the browser,
   and again on the server. */
export interface ErrorReport { message: string; stack: string | null; path: string; browser: string }
export interface ErrorRow { id: number; message: string; stack: string | null; path: string; browser: string; created_at: string }
export interface ErrorGroup { message: string; count: number; last: string; paths: string[]; browsers: string[]; stack: string | null }

export const MAX_PER_PAGE = 3; // a page that throws in a loop sends three reports, not three thousand

/** Removes emails, query strings and #fragments, and caps the length. */
export const scrub = (s: string, max: number) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
  .replace(/(?<=[\w/.%-])[?#][^\s):'"]*/g, "") // only after a URL-ish character, so "error #418" survives
  .slice(0, max);

/** Noise nobody can fix: other sites' scripts, browser extensions, and a harmless Chrome warning. */
export const worthReporting = (message: string, stack?: string | null) =>
  !!message && !/^Script error\.?$|ResizeObserver loop/i.test(message) && !/(chrome|moz|safari(-web)?)-extension:\/\//.test(`${message} ${stack ?? ""}`);

/** "/certificates/3f2a…" → "/certificates/:id": certificate ids are links people may not want shared. */
export const cleanPath = (p: string) => scrub(p, 200).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id") || "/";

/** Just the browser's name and whether it's a phone. null for bots, which we don't record. */
export function browserFamily(ua: string): string | null {
  if (!ua || /bot|crawl|spider|slurp|preview/i.test(ua)) return null;
  const name = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /OPR\//.test(ua) ? "Opera" : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Other";
  return /Mobi|Android|iPhone|iPad/.test(ua) ? `${name} (phone)` : name;
}

/** Turns whatever a browser posted into a report worth keeping, or null. */
export function cleanReport(body: unknown, ua: string): ErrorReport | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.message !== "string" || typeof b.path !== "string" || !b.path.startsWith("/")) return null;
  const stack = typeof b.stack === "string" ? scrub(b.stack, 2000) : null;
  const message = scrub(b.message.trim(), 300), browser = browserFamily(ua);
  if (!browser || !worthReporting(message, stack)) return null;
  return { message, stack: stack || null, path: cleanPath(b.path), browser };
}

/** The same error from many phones becomes one line: how often, when last, where and on what. */
export function groupErrors(rows: ErrorRow[]): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const r of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const g = groups.get(r.message);
    if (!g) { groups.set(r.message, { message: r.message, count: 1, last: r.created_at, paths: [r.path], browsers: [r.browser], stack: r.stack }); continue; }
    g.count++;
    if (!g.paths.includes(r.path)) g.paths.push(r.path);
    if (!g.browsers.includes(r.browser)) g.browsers.push(r.browser);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}

/** Reports per day for the last `days` days, oldest first (UTC days), for the strip on /admin. */
export function perDay(rows: Pick<ErrorRow, "created_at">[], days = 30, now = new Date()): { day: string; count: number }[] {
  const out = Array.from({ length: days }, (_, i) => ({ day: new Date(now.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10), count: 0 }));
  const at = new Map(out.map((d, i) => [d.day, i]));
  for (const r of rows) { const i = at.get(r.created_at.slice(0, 10)); if (i !== undefined) out[i].count++; }
  return out;
}
