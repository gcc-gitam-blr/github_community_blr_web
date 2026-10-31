import type { ClubEventData } from "./config";
import { CHEAT } from "./learn";

/* The weekly newsletter, as a draft, for Sunday or Monday: what's on this week, what happened last week, the club's news,
   one Git command, what GitHub shipped, and what members got merged. Plain text with blank lines between paragraphs, the
   way the broadcast tool sends it. One part is left for an organiser to write, marked [[ ]]; the send is refused while
   it's still there, so a draft can't go out half-finished. Nothing is sent until someone presses Send in /admin. */
export interface NewsInput {
  today: string; // "2026-11-02": the week runs from today; "last week" is the seven days before
  site: string;
  events: (ClubEventData & { slug: string })[];
  updates: { slug: string; title: string; date: string; summary: string }[];
  merged?: { count: number; people: string[] }; // members' merges into other people's projects in the past seven days
  github?: { title: string; url: string; date: string }[]; // GitHub's changelog
}

export const TO_WRITE = /\[\[[\s\S]*?\]\]/; // the part an organiser writes; sending is refused while it's in the message
const MAX = 4900; // the broadcast tool allows 5000 characters

const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const dayName = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const firstSentences = (t: string, max = 200) => { const s = t.replace(/\s+/g, " ").trim(); if (s.length <= max) return s; const cut = s.slice(0, max); const end = cut.lastIndexOf(". "); return end > 60 ? cut.slice(0, end + 1) : cut.replace(/\s\S*$/, "") + "…"; };

/** This week's Git command: the cheat sheet in order, one a week, the same all week. */
export function commandOfTheWeek(today: string) {
  const all = CHEAT.flatMap((g) => g.cmds.filter((c) => !c.cmd.includes('"')).map((c) => ({ ...c, group: g.group })));
  const week = Math.floor(Date.parse(today + "T00:00:00Z") / (7 * 864e5));
  return all[week % all.length];
}

export function newsletterDraft(i: NewsInput): { subject: string; message: string } {
  const weekAgo = addDays(i.today, -7), inAWeek = addDays(i.today, 7);
  const dated = i.events.filter((e) => !e.dateLabel).sort((a, b) => a.date.localeCompare(b.date));
  const thisWeek = dated.filter((e) => e.date >= i.today && e.date < inAWeek);
  const nextOne = dated.find((e) => e.date >= inAWeek);
  const lastWeek = dated.filter((e) => e.date >= weekAgo && e.date < i.today);
  const news = i.updates.filter((u) => u.date >= weekAgo && u.date <= i.today).sort((a, b) => a.date.localeCompare(b.date));
  const shipped = (i.github ?? []).filter((g) => g.date >= weekAgo).slice(0, 3);
  const cmd = commandOfTheWeek(i.today);
  const rsvp = (e: (typeof dated)[number]) => (e.luma ? `RSVP: ${e.luma}` : `${i.site}/events/${e.slug}`);

  const parts: string[] = ["Hi! Your five-minute catch-up from the GitHub Community Club."];
  if (thisWeek.length) parts.push("THIS WEEK", ...thisWeek.map((e) => `${dayName(e.date)}: ${e.title}, ${e.where}. ${firstSentences(e.text, 160)} ${rsvp(e)}`));
  else if (nextOne) parts.push("NEXT UP", `${dayName(nextOne.date)}: ${nextOne.title}. ${rsvp(nextOne)}`);
  if (lastWeek.length) parts.push("LAST WEEK", ...lastWeek.map((e) => `${e.title}. ${e.recap?.text ? firstSentences(e.recap.text) + " " : ""}Slides, recap and photos: ${i.site}/events/${e.slug}`));
  if (news.length) parts.push("NEWS", ...news.map((u) => `${u.title}. ${firstSentences(u.summary, 160)} ${i.site}/updates/${u.slug}`));
  parts.push("WORTH KNOWING", "[[One thing worth knowing this week, in your own words: an internship or hackathon that's open, a tool you liked, something that changed in tech. Two or three sentences and a link. Or delete this section.]]");
  parts.push("ONE GIT COMMAND", `${cmd.cmd}\n${cmd.what}. The rest of the cheat sheet: ${i.site}/learn`);
  if (shipped.length) parts.push("NEW ON GITHUB", ...shipped.map((g) => `${g.title}: ${g.url}`));
  if (i.merged?.count) {
    const who = i.merged.people.slice(0, 5), more = i.merged.people.length - who.length;
    parts.push("MERGED THIS WEEK", `Members got ${i.merged.count} pull request${i.merged.count === 1 ? "" : "s"} merged into other people's projects${who.length ? `: well done ${who.join(", ")}${more > 0 ? ` and ${more} more` : ""}` : ""}. ${i.site}/board`);
  }
  parts.push("See you soon,\nThe GitHub Community Club, GITAM Bengaluru");

  let message = parts.join("\n\n");
  if (message.length > MAX) message = message.slice(0, MAX).replace(/\n[^\n]*$/, "") + "\n\n(More on the website.)";
  const lead = thisWeek[0] ? `${dayName(thisWeek[0].date)}: ${thisWeek[0].title}` : `This week's Git command: ${cmd.cmd}`;
  return { subject: `${lead} · GitHub Community Club`.slice(0, 120), message };
}
