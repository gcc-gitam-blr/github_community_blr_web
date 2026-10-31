/* The weekly newsletter draft: what goes in, what doesn't, the part left to write, and that it fits the broadcast tool. */
import { TO_WRITE, commandOfTheWeek, newsletterDraft } from "../lib/newsletter";
import type { ClubEventData } from "../lib/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const ev = (date: string, title: string, extra: Partial<ClubEventData> = {}) => ({ date, title, type: "Workshop", text: "Bring a laptop.", where: "GITAM", shape: "diamond" as const, color: "blue" as const, slug: title.toLowerCase().replace(/\W+/g, "-"), ...extra });
const events = [
  ev("2026-10-12", "Learn GitHub", { recap: { text: "Eighty people came. Thirty-seven opened their first pull request. Then pizza." } }),
  ev("2026-10-28", "Last Week Session", { recap: { text: "Forty people merged a fix." } }),
  ev("2026-11-03", "Open Source Unlocked", { luma: "https://luma.com/osu" }),
  ev("2026-12-01", "Epoch", { dateLabel: "December 2026" }),
  ev("2027-01-04", "Build and Deploy", { luma: "https://luma.com/x" }),
];
const updates = [{ slug: "fresh", title: "Fresh news", date: "2026-10-30", summary: "Something new." }, { slug: "old", title: "Old news", date: "2026-10-02", summary: "x" }];
const github = [{ title: "Copilot does a thing", url: "https://github.blog/changelog/a", date: "2026-10-29" }, { title: "Ancient change", url: "https://github.blog/changelog/b", date: "2026-09-01" }];
const d = newsletterDraft({ today: "2026-11-01", site: "https://club.test", events, updates, merged: { count: 3, people: ["Ada", "Bob"] }, github });

ok("the subject leads with this week's event", d.subject.startsWith("Tue, 3 Nov: Open Source Unlocked") || d.subject.includes("3 Nov: Open Source Unlocked"));
ok("this week's event is in, with its RSVP link", d.message.includes("THIS WEEK") && d.message.includes("Open Source Unlocked, GITAM") && d.message.includes("RSVP: https://luma.com/osu"));
ok("last week's event is in, with its recap", d.message.includes("LAST WEEK") && d.message.includes("Forty people merged a fix.") && d.message.includes("https://club.test/events/last-week-session"));
ok("older events and later ones aren't", !d.message.includes("Eighty people") && !d.message.includes("Build and Deploy"));
ok("an event with only a month (Epoch, dates TBA) isn't listed as this week", !d.message.includes("Epoch,"));
ok("the past week's news is in; older news isn't", d.message.includes("Fresh news") && !d.message.includes("Old news"));
ok("only the past week of GitHub's changelog, linked", d.message.includes("Copilot does a thing: https://github.blog/changelog/a") && !d.message.includes("Ancient change"));
ok("members' merges are thanked by name", d.message.includes("3 pull requests merged") && d.message.includes("well done Ada, Bob"));
ok("there's one Git command, with what it does", d.message.includes("ONE GIT COMMAND") && d.message.includes(commandOfTheWeek("2026-11-01").cmd));
ok("the part an organiser writes is marked, so an unedited draft can't be sent", TO_WRITE.test(d.message) && !TO_WRITE.test(d.message.replace(TO_WRITE, "An internship is open.")));

const quiet = newsletterDraft({ today: "2026-11-10", site: "s", events, updates: [] });
ok("a week with no event points to the next one", quiet.message.includes("NEXT UP") && quiet.message.includes("Build and Deploy") && !quiet.message.includes("THIS WEEK"));
ok("…and the subject leads with the Git command instead", quiet.subject.startsWith("This week's Git command: git "));
ok("a year with nothing left still makes a sensible draft", newsletterDraft({ today: "2027-06-01", site: "s", events: [], updates: [] }).message.includes("See you soon"));
ok("the command is the same all week and changes the next", commandOfTheWeek("2026-11-02").cmd === commandOfTheWeek("2026-11-04").cmd && commandOfTheWeek("2026-11-02").cmd !== commandOfTheWeek("2026-11-09").cmd);
ok("commands with something to fill in by hand (your name, your email) are left out", !Array.from({ length: 60 }, (_, w) => commandOfTheWeek(new Date(Date.UTC(2026, 0, 1) + w * 7 * 864e5).toISOString().slice(0, 10)).cmd).some((c) => c.includes('"')));
ok("it fits the broadcast tool's 5000-character limit", newsletterDraft({ today: "2026-10-03", site: "s", events, updates: Array.from({ length: 80 }, (_, i) => ({ slug: `u${i}`, title: "A long title ".repeat(4), date: "2026-10-01", summary: "A long summary sentence. ".repeat(8) })) }).message.length <= 5000);
ok("the subject fits the broadcast tool's 120 characters", newsletterDraft({ today: "2026-11-01", site: "s", events: [ev("2026-11-02", "A very long event title ".repeat(8))], updates: [] }).subject.length <= 120);
if (fails) { console.log(`${fails} newsletter check(s) failed`); process.exit(1); }
console.log("all newsletter checks passed");
