import { EVENTS, eventSlug, type ClubEvent } from "./events";
import { lessonEmail, type AgendaItem } from "./email/lesson";
import { lessonBySlug, lessonOfTheWeek } from "./lessons";
import type { Mail } from "./email/templates";

/* The weekly newsletter: this week's "Git in 60 seconds" lesson, an optional note from the team, and what's next at the
   club. Built the same way for the admin's preview (in the browser) and for each person it's sent to (in /api/broadcast),
   so what the admin sees is what people get. */
export const NOTE_MAX = 600;
export type Audience = "members" | "epoch";
// the footer line that tells each person why this reached them
export const WHY: Record<Audience, string> = {
  members: "You're getting this because you joined the club or came to one of our events.",
  epoch: "You're getting this because you asked to hear when Epoch's dates are out.",
};

const plus = (day: string, n: number) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const when = (day: string) => new Date(day + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");

/** What's next at the club: the events in the coming 7 days, or else the next one. Events without a fixed date are left out. */
export function newsletterAgenda(today: string, site: string, events: readonly ClubEvent[] = EVENTS): { lead: string; items: AgendaItem[] } {
  const ahead = events.filter((e) => !e.dateLabel && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const week = ahead.filter((e) => e.date < plus(today, 7));
  return {
    lead: week.length ? "This week" : "Next up",
    items: (week.length ? week : ahead.slice(0, 1)).map((e) => ({ when: when(e.date), title: e.title, where: e.where || undefined, url: e.luma || `${site}/events/${eventSlug(e)}` })),
  };
}

export interface NewsletterInput { lesson?: string; note?: string; name?: string | null; today: string; site: string; unsubscribe: string; audience?: Audience; events?: readonly ClubEvent[] }

/** One person's copy of the newsletter. An unknown lesson falls back to this week's, so a send never fails on it. */
export function newsletterEmail(i: NewsletterInput): Mail {
  return lessonEmail({
    lesson: lessonBySlug(i.lesson) ?? lessonOfTheWeek(i.today),
    name: i.name, note: (i.note ?? "").trim().slice(0, NOTE_MAX), site: i.site, unsubscribe: i.unsubscribe,
    why: WHY[i.audience ?? "members"], agenda: newsletterAgenda(i.today, i.site, i.events),
  });
}
