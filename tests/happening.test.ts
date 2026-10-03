/* "Happening now" at Epoch: India time whatever the visitor's clock says, day boundaries, gaps, before/after, no start date. */
process.env.TZ = "America/Los_Angeles"; // a visitor far from India: the answers must not change
import { happening, istTime, slots, untilLabel } from "../lib/epoch/happening";
import { SCHEDULE } from "../lib/epoch/config";
import type { SessionItem } from "../lib/epoch/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const at = (s: string) => Date.parse(s); // always written with +05:30 below
const titles = (xs: { title: string }[]) => xs.map((x) => x.title).sort().join(" | ");
const S = (time: string, end: string | undefined, title: string, kind: SessionItem["kind"] = "Workshop"): SessionItem => ({ time, end, title, kind });

const plan = [
  { day: 1 as const, label: "Day 1", items: [S("09:00", "10:00", "Basics"), S("10:30", "12:00", "Portfolio"), S("09:00", "12:00", "Challenge", "Competition"), S("14:00", undefined, "Booths", "Booths"), S("16:00", "17:00", "Talk", "Talk")] },
  { day: 2 as const, label: "Day 2", items: [S("08:00", "10:00", "Advanced"), S("18:00", "19:00", "Closing", "Ceremony")] },
];
const START = "2026-12-11T09:00:00+05:30";

ok("this machine really isn't on India time", new Date(at("2026-12-11T12:00:00+05:30")).getTimezoneOffset() !== -330);
ok("no start date → nothing time-based", happening(plan, "", Date.now()).phase === "unset" && slots(plan, "").length === 0);
ok("a start date that isn't a date → nothing time-based", happening(plan, "soon", Date.now()).phase === "unset");

const before = happening(plan, START, at("2026-12-10T20:00:00+05:30"));
ok("the evening before: 'before', counting down to the first session", before.phase === "before" && titles(before.next) === "Basics | Challenge" && before.startsIn === 13 * 36e5);
ok("startsAt's time of day doesn't move Day 1 (it starts with the first session)", happening(plan, "2026-12-11T15:00:00+05:30", at("2026-12-11T09:30:00+05:30")).phase === "on");
ok("startsAt written in UTC still lands on the right day in India", happening(plan, "2026-12-10T22:00:00Z", at("2026-12-11T09:30:00+05:30")).phase === "on");

const first = happening(plan, START, at("2026-12-11T09:00:00+05:30"));
ok("at 09:00 sharp on Day 1, both 09:00 sessions are on", first.phase === "on" && first.day === 1 && titles(first.now) === "Basics | Challenge");
ok("…and next is 10:30", first.phase === "on" && titles(first.next) === "Portfolio");
const ten = happening(plan, START, at("2026-12-11T10:00:00+05:30"));
ok("a session's end time is exclusive (Basics is over at 10:00)", ten.phase === "on" && titles(ten.now) === "Challenge");

const lunch = happening(plan, START, at("2026-12-11T13:00:00+05:30"));
ok("in a gap, nothing is on and the next session is shown", lunch.phase === "on" && lunch.now.length === 0 && titles(lunch.next) === "Booths");
const late = happening(plan, START, at("2026-12-11T16:30:00+05:30"));
ok("with no end time, a session runs until the next one starts that day", late.phase === "on" && titles(late.now) === "Talk");
ok("…and the last session of a day without an end runs an hour", slots([{ day: 1, label: "Day 1", items: [S("14:00", undefined, "Solo")] }], START)[0].end - at("2026-12-11T14:00:00+05:30") === 36e5);

const night = happening(plan, START, at("2026-12-11T23:59:00+05:30"));
ok("23:59 in India is still Day 1, with Day 2's first session next", night.phase === "on" && night.day === 1 && night.now.length === 0 && titles(night.next) === "Advanced");
const midnight = happening(plan, START, at("2026-12-12T00:00:00+05:30"));
ok("00:00 in India is Day 2 (even though it's still the 11th in California)", midnight.phase === "on" && midnight.day === 2);
const d2 = happening(plan, START, at("2026-12-12T08:15:00+05:30"));
ok("Day 2 sessions use Day 2's date", d2.phase === "on" && d2.day === 2 && titles(d2.now) === "Advanced");

const closing = happening(plan, START, at("2026-12-12T18:59:00+05:30"));
ok("the closing ceremony is on until it ends, with nothing after it", closing.phase === "on" && titles(closing.now) === "Closing" && closing.next.length === 0);
ok("after the last session ends: 'after'", happening(plan, START, at("2026-12-12T19:00:00+05:30")).phase === "after");
ok("a week later: still 'after'", happening(plan, START, at("2026-12-19T12:00:00+05:30")).phase === "after");

ok("times print in India time", istTime(at("2026-12-11T08:30:00+05:30")) === "08:30" && istTime(at("2026-12-11T00:05:00Z")) === "05:35");
ok("countdown labels read naturally", untilLabel(25 * 6e4) === "in 25 min" && untilLabel(130 * 6e4) === "in 2 h 10 min" && untilLabel(120 * 6e4) === "in 2 h" && untilLabel(3 * 864e5) === "in 3 days" && untilLabel(20e3) === "in 1 min");
ok("the real schedule turns into sessions once a date is set", slots(SCHEDULE, START).length === SCHEDULE.reduce((n, d) => n + d.items.length, 0));

console.log(fails ? `\n${fails} FAILED` : "\nall happening-now checks passed"); process.exit(fails ? 1 : 0);
