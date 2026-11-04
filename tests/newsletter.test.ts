/* The weekly newsletter: this week's lesson, the team's note, and what's next at the club. */
import { NOTE_MAX, WHY, newsletterAgenda, newsletterEmail } from "../lib/newsletter";
import { LESSONS, lessonOfTheWeek } from "../lib/lessons";
import type { ClubEvent } from "../lib/events";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const site = "https://club.test";
const ev = (date: string, title: string, more: Partial<ClubEvent> = {}) => ({ date, title, type: "Workshop", text: "", where: "Seminar hall", shape: "circle", color: "blue", ...more }) as unknown as ClubEvent;
const events = [ev("2026-11-01", "Past talk"), ev("2026-11-06", "Git basics"), ev("2026-11-09", "Open Source Unlocked", { luma: "https://lu.ma/osu" }), ev("2026-11-20", "Later meetup"), ev("2026-12-01", "Epoch", { dateLabel: "December 2026" })];

const week = newsletterAgenda("2026-11-04", site, events);
ok("this week's events are listed under \"This week\", in date order, past ones left out", week.lead === "This week" && week.items.map((e) => e.title).join() === "Git basics,Open Source Unlocked");
ok("an event links to its Luma page when it has one, otherwise to its page on the site", week.items[1].url === "https://lu.ma/osu" && week.items[0].url === `${site}/events/git-basics`);
ok("the date reads like a person wrote it", week.items[0].when === "Fri 6 Nov");
const later = newsletterAgenda("2026-11-10", site, events);
ok("a quiet week shows just the next event, under \"Next up\"", later.lead === "Next up" && later.items.map((e) => e.title).join() === "Later meetup");
ok("an event with no fixed date (Epoch: December) isn't listed as if it had one", newsletterAgenda("2026-11-21", site, events).items.length === 0);

const base = { today: "2026-11-04", site, unsubscribe: `${site}/u` };
const m = newsletterEmail({ ...base, events, name: "Ada Lovelace", note: "Bring a laptop." });
ok("by default it's this week's lesson, greeting the person by name", m.subject === lessonOfTheWeek("2026-11-04").subject && m.html.includes("Hey Ada,"));
ok("a chosen lesson is used, and an unknown one falls back to this week's instead of failing", newsletterEmail({ ...base, lesson: LESSONS[3].slug }).subject === LESSONS[3].subject && newsletterEmail({ ...base, lesson: "nope" }).subject === lessonOfTheWeek("2026-11-04").subject);
ok("the team's note is included, cut to its limit", m.html.includes("Bring a laptop.") && newsletterEmail({ ...base, note: "x".repeat(NOTE_MAX + 50) }).text.includes("x".repeat(NOTE_MAX) + "\n"));
ok("the footer says why it came, for each list", newsletterEmail({ ...base, audience: "epoch" }).text.includes(WHY.epoch) && m.text.includes(WHY.members));

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall newsletter checks passed");
