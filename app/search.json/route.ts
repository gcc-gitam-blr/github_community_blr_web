import { getUpdates, updateDate } from "@/lib/updates";
import type { Entry } from "@/lib/search";

/* GET /search.json — the parts of the site-search index that are read from files at build time (update posts).
   Everything else is built into the page (lib/search.ts). Static, so it's served from the CDN. */
export const dynamic = "force-static";

export function GET() {
  const updates: Entry[] = getUpdates().map((u) => ({ kind: "Update", title: u.title, hint: `${updateDate(u.date)} · ${u.tag}`, href: `/updates/${u.slug}`, keywords: u.summary }));
  return Response.json(updates);
}
