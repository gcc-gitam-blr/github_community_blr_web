/* Organiser desk stats: counts per week, per first event, per message kind, and the feedback average. */
import { clubStats, weekStart } from "../lib/stats";
import type { ClubMessage, EventFeedback, JoinRequest } from "../lib/epoch/types";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const now = new Date(2026, 9, 2, 15, 0); // Friday 2 Oct 2026, 3 pm local
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const join = (createdAt: string, firstEvent = "2026-10-07"): JoinRequest => ({ id: createdAt + firstEvent, handle: "a", email: "a@b.in", firstEvent, createdAt });
const msg = (kind: string, createdAt: string): ClubMessage => ({ id: kind + createdAt, kind, name: "A", email: "a@b.in", handle: "", message: "hello there", createdAt });
const fb = (rating: number): EventFeedback => ({ id: String(rating) + Math.random(), event: "2026-10-07", rating, liked: "", improve: "", createdAt: at(2026, 10, 1) });

ok("weeks start on Monday", weekStart(now).getDay() === 1 && weekStart(now).getDate() === 28);
ok("a Monday is its own week start", weekStart(new Date(2026, 8, 28, 0, 0)).getDate() === 28);
ok("a Sunday belongs to the week before", weekStart(new Date(2026, 9, 4, 23, 0)).getDate() === 28);

const s = clubStats([
  join(at(2026, 10, 2)), join(at(2026, 9, 28, 0)), join(at(2026, 9, 27, 23), "2026-10-12"),
  join(at(2026, 9, 21), "2026-10-12"), join(at(2026, 6, 1), "2026-12-01"), // long ago: counted in totals, not in the 8 weeks
], [msg("apply", at(2026, 10, 1)), msg("question", at(2026, 9, 1)), msg("apply", at(2026, 9, 30))], [fb(5), fb(4), fb(4), fb(9)], now);

ok("total sign-ups", s.signUps === 5);
ok("sign-ups in the last 7 days", s.thisWeek === 3);
ok("eight weeks, the last one this week", s.weeks.length === 8 && s.weeks[7].start === "2026-09-28");
ok("this week counts Monday 00:00 onwards", s.weeks[7].count === 2);
ok("Sunday 11 pm goes to the previous week", s.weeks[6].count === 2 && s.weeks[6].start === "2026-09-21");
ok("sign-ups older than eight weeks are left out of the chart", s.weeks.reduce((a, w) => a + w.count, 0) === 4);
ok("first events, most popular first", s.firstEvents[0].event === "2026-10-07" && s.firstEvents[0].count === 2 && s.firstEvents[1].event === "2026-10-12");
ok("messages by kind", s.messages[0].kind === "apply" && s.messages[0].count === 2 && s.newMessages === 2);
ok("feedback average ignores impossible ratings, one decimal", s.feedback.count === 3 && s.feedback.average === 4.3);
const empty = clubStats([], [], [], now);
ok("no data: zeros and no average, not NaN", empty.signUps === 0 && empty.feedback.average === null && empty.weeks.every((w) => w.count === 0));

if (fails) { console.log(`${fails} stats check(s) failed`); process.exit(1); }
console.log("all stats checks passed");
