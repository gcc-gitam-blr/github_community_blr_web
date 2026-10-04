import type { ClubEventData } from "./config";

/* The monthly newsletter, as a draft: what happened that month (events and their recaps), the club's news, what members
   got merged, and what's coming up. Plain text with blank lines between paragraphs, the way the broadcast tool sends it.
   An organiser reads and edits it in /admin before anything goes out. */
export interface NewsInput {
  month: string; // "2026-10"
  today: string; // "2026-11-02", for what's coming up
  site: string;
  events: (ClubEventData & { slug: string })[];
  updates: { slug: string; title: string; date: string; summary: string }[];
  merged?: { count: number; people: string[] }; // members' merges into other people's projects that month
}

const monthName = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const dayName = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const firstSentences = (t: string, max = 220) => { const s = t.replace(/\s+/g, " ").trim(); if (s.length <= max) return s; const cut = s.slice(0, max); const end = cut.lastIndexOf(". "); return end > 60 ? cut.slice(0, end + 1) : cut.replace(/\s\S*$/, "") + "…"; };
const MAX = 4900; // the broadcast tool allows 5000 characters

export function newsletterDraft(i: NewsInput): { subject: string; message: string } {
  const name = monthName(i.month);
  const happened = i.events.filter((e) => e.date.startsWith(i.month) && e.date <= i.today && !e.dateLabel);
  const news = i.updates.filter((u) => u.date.startsWith(i.month)).sort((a, b) => a.date.localeCompare(b.date));
  const next = i.events.filter((e) => e.date > i.today && !e.dateLabel).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const parts: string[] = [`Hi! Here's what happened in the club in ${name.split(" ")[0]}, and what's coming next.`];

  if (happened.length) parts.push("WHAT HAPPENED", ...happened.map((e) => `${e.title} (${dayName(e.date)}). ${e.recap?.text ? firstSentences(e.recap.text) + " " : ""}Recap, slides and photos: ${i.site}/events/${e.slug}`));
  if (news.length) parts.push("NEWS", ...news.map((u) => `${u.title}. ${firstSentences(u.summary, 160)} ${i.site}/updates/${u.slug}`));
  if (i.merged?.count) {
    const who = i.merged.people.slice(0, 5), more = i.merged.people.length - who.length;
    parts.push("MERGED THIS MONTH", `Members got ${i.merged.count} pull request${i.merged.count === 1 ? "" : "s"} merged into other people's projects${who.length ? `: thank you ${who.join(", ")}${more > 0 ? ` and ${more} more` : ""}` : ""}. See the board: ${i.site}/board`);
  }
  if (next.length) parts.push("COMING UP", ...next.map((e) => `${dayName(e.date)}: ${e.title}. ${e.luma ? `RSVP: ${e.luma}` : `${i.site}/events/${e.slug}`}`));
  parts.push(`New to Git? Start with the Learn hub: ${i.site}/learn`, "See you there,\nThe GitHub Community Club, GITAM Bengaluru");

  let message = parts.join("\n\n");
  if (message.length > MAX) message = message.slice(0, MAX).replace(/\n[^\n]*$/, "") + "\n\n(More on the website.)";
  return { subject: `GitHub Community Club · ${name}`, message };
}

/** The month a newsletter is usually about: last month during the first ten days, otherwise this one. */
export const defaultMonth = (today: string) => {
  const [y, m, d] = today.split("-").map(Number);
  if (d > 10) return today.slice(0, 7);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
