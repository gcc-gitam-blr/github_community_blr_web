/* "Git in 60 seconds": the weekly newsletter's lessons and the email they go out in. */
import { LESSONS, lessonBySlug, lessonOfTheWeek } from "../lib/lessons";
import { lessonEmail, lessonNumber } from "../lib/email/lesson";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const site = "https://club.test";
const base = { site, unsubscribe: "https://club.test/u?t=1", why: "You're getting this because you joined the club." };

ok("there are lessons through Epoch (8 or more), each with its own slug", LESSONS.length >= 8 && new Set(LESSONS.map((l) => l.slug)).size === LESSONS.length);
ok("every lesson is complete: puzzle, hint, problem, 2 to 4 steps, before and after, habit, summary, poll", LESSONS.every((l) => [l.subject, l.preheader, l.setup, l.question, l.hint, l.problem.title, l.problem.text, l.habit.title, l.habit.text, l.summary, l.poll.question, l.poll.yes, l.poll.no].every((s) => s.trim().length > 1)
  && l.steps.length >= 2 && l.steps.length <= 4 && l.before.lines.length > 0 && l.after.lines.length > 0 && !!l.before.cmd && !!l.after.cmd));
ok("subjects fit an inbox line (80 characters or fewer)", LESSONS.every((l) => l.subject.length <= 80));
ok("no em dashes anywhere in the copy", !LESSONS.some((l) => JSON.stringify(l).includes("—")));
ok("the lesson is the same all week and changes the next", lessonOfTheWeek("2026-11-05").slug === lessonOfTheWeek("2026-11-07").slug && lessonOfTheWeek("2026-11-05").slug !== lessonOfTheWeek("2026-11-12").slug);
ok("every lesson comes round once before any repeats", new Set(Array.from({ length: LESSONS.length }, (_, w) => lessonOfTheWeek(new Date(Date.UTC(2026, 10, 5) + w * 7 * 864e5).toISOString().slice(0, 10)).slug)).size === LESSONS.length);
ok("the first issue (Sunday 8 Nov 2026) sends lesson 1, and the next Sunday lesson 2", lessonOfTheWeek("2026-11-08").slug === LESSONS[0].slug && lessonOfTheWeek("2026-11-14").slug === LESSONS[0].slug && lessonOfTheWeek("2026-11-15").slug === LESSONS[1].slug);
ok("a lesson is found by its slug, and an unknown slug finds nothing", lessonBySlug("branches")?.slug === "branches" && lessonBySlug("nope") === undefined && lessonNumber(LESSONS[2]) === 3);

const l = LESSONS[0];
const m = lessonEmail({ ...base, lesson: l, name: "Ada Lovelace", note: "Bring a laptop <b>please</b>\nSecond line", agenda: { lead: "Next up", items: [{ when: "Tue 17 Nov", title: "Open Source Unlocked", where: "Seminar hall", url: "https://club.test/events/osu" }] } });
ok("the subject is the puzzle", m.subject === l.subject);
ok("it greets people by first name, and just \"Hey,\" without one", m.html.includes("Hey Ada,") && m.text.includes("Hey Ada,") && lessonEmail({ ...base, lesson: l }).html.includes("Hey,"));
ok("a GitHub-username-looking name isn't used as a greeting", !lessonEmail({ ...base, lesson: l, name: "lechakrawarthy" }).html.includes("Hey lechakrawarthy"));
ok("the team's note shows, escaped, with its line breaks", m.html.includes("FROM THE TEAM") && m.html.includes("Bring a laptop &lt;b&gt;please&lt;/b&gt;<br>Second line") && !lessonEmail({ ...base, lesson: l }).html.includes("FROM THE TEAM"));
ok("the poll buttons are ready-made replies to the club", (m.html.match(/href="mailto:[^"]+Poll%3A%20commit-messages%2C%20(yes|no)"/g) ?? []).length === 2);
ok("what's next at the club shows with its link, and is left out when there's nothing", m.html.includes("NEXT UP AT THE CLUB") && m.html.includes('href="https://club.test/events/osu"') && !lessonEmail({ ...base, lesson: l, agenda: { lead: "Next up", items: [] } }).html.includes("AT THE CLUB"));
ok("every email has its unsubscribe link and says why it came", m.html.includes('href="https://club.test/u?t=1"') && m.text.includes("Unsubscribe: https://club.test/u?t=1") && m.text.includes(base.why) && m.html.includes("joined the club."));
ok("the pictures are the club's stickers, each with alt text", (m.html.match(/<img [^>]*>/g) ?? []).every((t) => t.includes(`src="${site}/stickers/`) && /alt="[^"]+"/.test(t)));
ok("terminal text is escaped, so a lesson can show HTML like <<<<<<< HEAD", lessonEmail({ ...base, lesson: lessonBySlug("merge-conflicts")! }).html.includes("&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD"));
ok("the plain-text version has the whole lesson", LESSONS.every((x) => { const t = lessonEmail({ ...base, lesson: x }).text; return t.includes(x.question) && t.includes(x.problem.title) && x.steps.every((s) => t.includes(s.title)) && t.includes(x.summary); }));

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall lesson checks passed");
