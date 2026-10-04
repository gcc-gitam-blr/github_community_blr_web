/* Badges: earned only from counted merges (other people's projects), and only what each rule says. */
import { badgesByMember, badgesFor } from "../lib/badges";
import type { MergedPr } from "../lib/board";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
let id = 0;
const pr = (author: string, repo: string, merged = "2026-10-10T10:00:00Z"): MergedPr => ({ id: ++id, title: "t", url: "u", repo, author, merged });
const ids = (prs: MergedPr[], done = false) => badgesFor(prs, done).map((b) => b.id).join();

ok("no merges, no badges", ids([]) === "");
ok("one merge: First merge", ids([pr("a", "x/y")]) === "first-merge");
ok("five merges in one repo: First merge and Five merged", ids(Array.from({ length: 5 }, () => pr("a", "x/y"))) === "first-merge,five-merged");
ok("ten merges in three repos: all four merge badges", ids(Array.from({ length: 10 }, (_, i) => pr("a", ["x/y", "p/q", "r/s"][i % 3]))) === "first-merge,five-merged,ten-merged,three-projects");
ok("repos are counted case-insensitively", ids([pr("a", "X/Y"), pr("a", "x/y"), pr("a", "p/q")]) === "first-merge");
ok("finishing the challenge adds its badge", ids([pr("a", "x/y")], true) === "first-merge,challenge");

const members = [{ name: "A", handle: "Ada" }, { name: "B", handle: "bob" }];
const all = [pr("ada", "x/y"), pr("ada", "ada/own"), pr("bob", "bob/own"), pr("stranger", "x/y")];
const m = badgesByMember(all, members);
ok("merges into your own repo don't earn a badge", (m.get("bob") ?? []).length === 0);
ok("handles match whatever their case", (m.get("ada") ?? []).map((b) => b.id).join() === "first-merge");
const c = { name: "October", from: "2026-10-01", to: "2026-10-31", goal: 1 };
ok("the challenge badge goes to people who reached its goal in its window", (badgesByMember(all, members, c).get("ada") ?? []).some((b) => b.id === "challenge"));
ok("…and not to people who didn't", !(badgesByMember(all, members, c).get("bob") ?? []).some((b) => b.id === "challenge"));
if (fails) { console.log(`${fails} badge check(s) failed`); process.exit(1); }
console.log("all badge checks passed");
