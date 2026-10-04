import { EVENTS, eventSlug, todayInIndia } from "@/lib/events";
import { getUpdates } from "@/lib/updates";
import { boardMembers, counted, loadBoard } from "@/lib/board";
import { defaultMonth, newsletterDraft } from "@/lib/newsletter";
import { SITE_URL } from "@/lib/site";
import { istDay } from "@/lib/challenge";

/* GET /api/newsletter?month=2026-10 — a draft of that month's newsletter for the "Email everyone" tool in /admin.
   Built only from what the site already shows publicly, so it needs no sign-in; sending still does. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const today = todayInIndia();
  const asked = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : defaultMonth(today);
  const board = await loadBoard().catch(() => null); // GitHub being slow mustn't stop the draft
  const members = boardMembers();
  const inMonth = board ? counted(board.prs, members).filter((p) => istDay(p.merged).slice(0, 7) === month) : []; // by the date in India
  const people = [...new Set(inMonth.map((p) => members.find((m) => m.handle.toLowerCase() === p.author.toLowerCase())?.name ?? p.author))];
  const draft = newsletterDraft({
    month, today, site: SITE_URL,
    events: EVENTS.map((e) => ({ ...e, slug: eventSlug(e) })),
    updates: getUpdates().map((u) => ({ slug: u.slug, title: u.title, date: u.date, summary: u.summary })),
    merged: { count: inMonth.length, people },
  });
  return Response.json({ month, ...draft });
}
