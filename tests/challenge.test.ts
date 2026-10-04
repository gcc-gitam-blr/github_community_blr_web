/* The contribution challenge on the board: reading it from the editor, the IST window, and how progress is counted. */
import { CHALLENGE, challengeProgress, challengeState, daysLeft, istDay, readChallenge, sampleChallenge } from "../lib/challenge";
import { sampleBoard, type MergedPr } from "../lib/board";
import { CLUB } from "../lib/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

// reading it from content/club/challenge.json
const full = { name: "October contribution challenge", from: "2026-10-01", to: "2026-10-31", goal: 4, description: "" };
ok("an empty form means no challenge", readChallenge({ name: "", from: null, to: null, goal: null, description: "" }) === undefined);
ok("a half-filled form means no challenge", readChallenge({ ...full, goal: null }) === undefined && readChallenge({ ...full, to: null }) === undefined && readChallenge({ ...full, name: "  " }) === undefined);
ok("dates the wrong way round mean no challenge", readChallenge({ ...full, from: "2026-11-01" }) === undefined);
ok("a goal of 0 means no challenge", readChallenge({ ...full, goal: 0 }) === undefined);
ok("a filled-in form is read, an empty description is left out", readChallenge(full)?.goal === 4 && readChallenge(full)?.description === undefined);
ok("the content file in the repo is valid or empty", CHALLENGE === undefined || CHALLENGE.goal > 0);

// days in India
ok("19:00 UTC on 31 Oct is already 1 Nov in India", istDay("2026-10-31T19:00:00Z") === "2026-11-01");
ok("18:29 UTC on 31 Oct is still 31 Oct in India", istDay("2026-10-31T18:29:59Z") === "2026-10-31");
ok("00:10 IST on 1 Oct (30 Sept in UTC) is 1 Oct", istDay("2026-09-30T18:40:00Z") === "2026-10-01");

const c = readChallenge(full)!;
const at = (iso: string) => new Date(iso);
ok("before the first day it's upcoming", challengeState(c, at("2026-09-30T18:00:00Z")) === "upcoming");
ok("from midnight IST on the first day it's on", challengeState(c, at("2026-09-30T18:30:00Z")) === "on");
ok("on the last evening in India it's still on", challengeState(c, at("2026-10-31T18:00:00Z")) === "on");
ok("after midnight IST it has finished", challengeState(c, at("2026-10-31T18:31:00Z")) === "finished");
ok("two weeks later it's over and hidden", challengeState(c, at("2026-11-16T12:00:00Z")) === "over" && challengeState(c, at("2026-11-14T12:00:00Z")) === "finished");
ok("days left counts today: 31 on 1 Oct, 1 on the last day", daysLeft(c, at("2026-10-01T06:00:00Z")) === 31 && daysLeft(c, at("2026-10-31T06:00:00Z")) === 1);

// counting progress, the same way as the board
const members = [{ name: "Asha", handle: "asha" }, { name: "Ravi", handle: "ravi-k" }, { name: "Meera", handle: "meera" }, { name: "Dev", handle: "dev" }];
const pr = (id: number, author: string, repo: string, merged: string): MergedPr => ({ id, title: `PR ${id}`, url: `https://github.com/${repo}/pull/${id}`, repo, author, merged });
const prs = [
  // Asha: four in October → reached the goal with the fourth, on 20 Oct
  pr(1, "asha", "vercel/next.js", "2026-10-02T10:00:00Z"), pr(2, "asha", "nodejs/node", "2026-10-05T10:00:00Z"),
  pr(3, "asha", "mdn/content", "2026-10-11T10:00:00Z"), pr(4, "asha", "python/cpython", "2026-10-20T10:00:00Z"),
  pr(5, "asha", "asha/dotfiles", "2026-10-21T10:00:00Z"), // her own repo: doesn't count
  // Ravi: four, but one was merged at 00:30 on 1 Nov in India (19:00 UTC on 31 Oct), so three count
  pr(10, "ravi-k", "nodejs/node", "2026-10-03T10:00:00Z"), pr(11, "Ravi-K", "nodejs/node", "2026-10-04T10:00:00Z"),
  pr(12, "ravi-k", "rust-lang/rust", "2026-10-31T18:00:00Z"), pr(13, "ravi-k", "go/go", "2026-10-31T19:00:00Z"),
  pr(10, "ravi-k", "nodejs/node", "2026-10-03T10:00:00Z"), // the same PR from two overlapping searches
  // Meera: one at 00:10 IST on 1 Oct counts; one in September doesn't; then five more → reached on 15 Oct, before Asha
  pr(20, "meera", "facebook/react", "2026-09-30T18:40:00Z"), pr(21, "meera", "facebook/react", "2026-09-29T10:00:00Z"),
  pr(22, "meera", "a/b", "2026-10-06T10:00:00Z"), pr(23, "meera", "a/c", "2026-10-07T10:00:00Z"), pr(24, "meera", "a/d", "2026-10-15T10:00:00Z"), pr(25, "meera", "a/e", "2026-10-25T10:00:00Z"),
  pr(30, "stranger", "torvalds/linux", "2026-10-05T10:00:00Z"), // not a member
];
const { done, going } = challengeProgress(prs, members, c);
const find = (h: string) => [...done, ...going].find((p) => p.member.handle === h);
ok("own repos, duplicates and other months don't count", find("asha")!.merged === 4 && find("ravi-k")!.merged === 3);
ok("a PR merged just after midnight IST on 1 Nov is outside the challenge", find("ravi-k")!.merged === 3 && !find("ravi-k")!.reachedAt);
ok("a PR merged just after midnight IST on 1 Oct is inside it", find("meera")!.merged === 5);
ok("reaching the goal is dated by the PR that reached it", find("asha")!.reachedAt === "2026-10-20T10:00:00Z" && find("meera")!.reachedAt === "2026-10-15T10:00:00Z");
ok("whoever reached the goal first is listed first", done.map((p) => p.member.handle).join() === "meera,asha");
ok("people on the way are listed by how far they are", going.map((p) => p.member.handle).join() === "ravi-k");
ok("members with nothing merged and non-members aren't listed", !find("dev") && !find("stranger"));
ok("no PRs → nobody listed", challengeProgress([], members, c).done.length === 0 && challengeProgress([], members, c).going.length === 0);
const two = readChallenge({ ...full, goal: 2 })!;
ok("a lower goal moves people across", challengeProgress(prs, members, two).done.length === 3 && challengeProgress(prs, members, two).done[0].member.handle === "ravi-k");

// the preview sample
const now = at("2026-10-04T06:00:00Z"), s = sampleChallenge(now), sb = sampleBoard(now), sp = challengeProgress(sb.prs, sb.members, s);
const real = new Set([...CLUB.team, ...CLUB.contributors].map((p) => p.handle.toLowerCase()).filter(Boolean));
ok("the sample challenge is on, and says it's a sample", challengeState(s, now) === "on" && /sample/i.test(s.name));
ok("the sample shows someone done and someone on the way, never a real member", sp.done.length >= 1 && sp.going.length >= 1 && [...sp.done, ...sp.going].every((p) => !real.has(p.member.handle.toLowerCase())));

if (fails) { console.log(`${fails} challenge check(s) failed`); process.exit(1); }
console.log("all challenge checks passed");
