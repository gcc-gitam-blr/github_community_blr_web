/* The monthly newsletter draft: what goes in, what doesn't, and that it fits the broadcast tool. */
import { defaultMonth, newsletterDraft } from "../lib/newsletter";
import type { ClubEventData } from "../lib/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const ev = (date: string, title: string, extra: Partial<ClubEventData> = {}) => ({ date, title, type: "Workshop", text: "", where: "GITAM", shape: "diamond" as const, color: "blue" as const, slug: title.toLowerCase().replace(/\W+/g, "-"), ...extra });
const events = [
  ev("2026-10-07", "Learn GitHub", { recap: { text: "Eighty people came. Thirty-seven opened their first pull request. Then pizza." } }),
  ev("2026-10-12", "GIT Merge"),
  ev("2026-12-01", "Epoch", { dateLabel: "December 2026" }),
  ev("2027-01-04", "Build and Deploy", { luma: "https://luma.com/x" }),
  ev("2026-11-20", "Upcoming November"),
];
const d = newsletterDraft({ month: "2026-10", today: "2026-11-02", site: "https://club.test", events, updates: [{ slug: "cal", title: "Calendar is out", date: "2026-10-02", summary: "Six events." }, { slug: "old", title: "September news", date: "2026-09-20", summary: "x" }], merged: { count: 3, people: ["Ada", "Bob"] } });

ok("the subject names the month", d.subject === "GitHub Community Club · October 2026");
ok("that month's events are in, with their recap link", d.message.includes("Learn GitHub (") && d.message.includes("https://club.test/events/learn-github") && d.message.includes("GIT Merge"));
ok("a recap's opening sentences are quoted", d.message.includes("Eighty people came."));
ok("an event with only a month (Epoch, dates TBA) isn't counted as happened", !d.message.includes("Epoch ("));
ok("that month's news is in; other months' isn't", d.message.includes("Calendar is out") && !d.message.includes("September news"));
ok("members' merges are thanked by name", d.message.includes("3 pull requests merged") && d.message.includes("thank you Ada, Bob"));
ok("what's coming up is after today, soonest first, with RSVP links", d.message.indexOf("Upcoming November") < d.message.indexOf("Build and Deploy") && d.message.includes("RSVP: https://luma.com/x"));
ok("it fits the broadcast tool's 5000-character limit", newsletterDraft({ month: "2026-10", today: "2026-11-02", site: "s", events, updates: Array.from({ length: 80 }, (_, i) => ({ slug: `u${i}`, title: "A long title ".repeat(4), date: "2026-10-03", summary: "A long summary sentence. ".repeat(8) })) }).message.length <= 5000);
ok("a quiet month still makes a sensible draft", newsletterDraft({ month: "2026-08", today: "2026-09-02", site: "s", events: [], updates: [] }).message.includes("See you there"));
ok("early in a month it drafts last month; later, this month", defaultMonth("2026-11-04") === "2026-10" && defaultMonth("2026-11-20") === "2026-11" && defaultMonth("2027-01-03") === "2026-12");
if (fails) { console.log(`${fails} newsletter check(s) failed`); process.exit(1); }
console.log("all newsletter checks passed");
