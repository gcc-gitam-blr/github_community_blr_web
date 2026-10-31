import { EVENTS, eventSlug, todayInIndia } from "@/lib/events";
import { getUpdates } from "@/lib/updates";
import { counted } from "@/lib/board";
import { loadClubBoard } from "@/lib/board-server";
import { getChangelog } from "@/lib/github-changelog";
import { newsletterDraft } from "@/lib/newsletter";
import { SITE_URL } from "@/lib/site";
import { istDay } from "@/lib/challenge";

/* GET /api/newsletter — a draft of this week's newsletter for the "Email everyone" tool in /admin.
   Built only from what the site already shows publicly, so it needs no sign-in; sending still does. */
export const dynamic = "force-dynamic";

export async function GET() {
  const today = todayInIndia();
  const weekAgo = new Date(Date.parse(today + "T00:00:00Z") - 7 * 864e5).toISOString().slice(0, 10);
  // GitHub being slow mustn't stop the draft: each part is left out if it doesn't arrive
  const [board, github] = await Promise.all([loadClubBoard().catch(() => null), getChangelog(12)]);
  const members = board?.members ?? [];
  const inWeek = board ? counted(board.prs, members).filter((p) => istDay(p.merged) >= weekAgo) : []; // by the date in India
  const people = [...new Set(inWeek.map((p) => members.find((m) => m.handle.toLowerCase() === p.author.toLowerCase())?.name ?? p.author))];
  const draft = newsletterDraft({
    today, site: SITE_URL,
    events: EVENTS.map((e) => ({ ...e, slug: eventSlug(e) })),
    updates: getUpdates().map((u) => ({ slug: u.slug, title: u.title, date: u.date, summary: u.summary })),
    merged: { count: inWeek.length, people },
    github: github.map((g) => ({ title: g.title, url: g.url, date: g.date })),
  });
  return Response.json({ today, ...draft });
}
