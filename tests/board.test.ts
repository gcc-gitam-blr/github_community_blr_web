/* The contribution board: who's followed, how GitHub is asked, and how merged PRs are counted. */
import { boardMembers, queries, sampleBoard, summarise, type MergedPr } from "../lib/board";
import { CLUB } from "../lib/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const people = [{ name: "Asha", handle: "asha" }, { name: "No Handle", handle: "" }, { name: "Asha again", handle: "ASHA" }, { name: "Ravi", handle: "ravi-k" }];
const members = boardMembers(people);
ok("only people with a GitHub handle are followed, once each", members.map((m) => m.handle).join() === "asha,ravi-k");

const many = Array.from({ length: 40 }, (_, i) => `member-handle-${i}`);
const qs = queries(many, "2026-06-01");
ok("every query fits GitHub's 256-character limit", qs.every((q) => q.length <= 256));
ok("every member is asked about exactly once", qs.join(" ").match(/author:/g)!.length === 40);
ok("every query asks for merged PRs since the club year began", qs.every((q) => q.startsWith("is:pr is:merged merged:>=2026-06-01 author:")));
ok("nobody to follow → no queries", queries([]).length === 0);

const pr = (id: number, author: string, repo: string, merged: string): MergedPr => ({ id, title: `PR ${id}`, url: `https://github.com/${repo}/pull/${id}`, repo, author, merged });
const prs = [
  pr(1, "asha", "vercel/next.js", "2026-09-01T10:00:00Z"),
  pr(2, "asha", "asha/dotfiles", "2026-09-02T10:00:00Z"), // her own repo: doesn't count
  pr(3, "ravi-k", "nodejs/node", "2026-09-03T10:00:00Z"),
  pr(4, "Ravi-K", "nodejs/node", "2026-09-04T10:00:00Z"), // GitHub logins are case-insensitive
  pr(5, "ravi-k", "python/cpython", "2026-08-01T10:00:00Z"),
  pr(3, "ravi-k", "nodejs/node", "2026-09-03T10:00:00Z"), // the same PR from two overlapping searches
  pr(6, "stranger", "torvalds/linux", "2026-09-05T10:00:00Z"), // not a member
];
const { rows, recent } = summarise(prs, members, 3);
ok("PRs into your own repos don't count", rows.find((r) => r.member.handle === "asha")!.prs === 1);
ok("the same PR isn't counted twice", rows.find((r) => r.member.handle === "ravi-k")!.prs === 3);
ok("distinct repos are counted", rows.find((r) => r.member.handle === "ravi-k")!.repos.length === 2);
ok("most merged PRs ranks first", rows[0].member.handle === "ravi-k");
ok("non-members never appear", !rows.some((r) => r.member.handle === "stranger") && !recent.some((p) => p.author === "stranger"));
ok("latest is the most recent merge", rows[0].latest.id === 4);
ok("recent merges are newest first and capped", recent.length === 3 && recent[0].id === 4 && recent[1].id === 3);
ok("no PRs → an empty board", summarise([], members).rows.length === 0);
const s = sampleBoard(), real = new Set([...CLUB.team, ...CLUB.contributors].map((p) => p.handle.toLowerCase()).filter(Boolean));
ok("the preview sample never names a real member", s.rows.length > 0 && s.rows.every((r) => !real.has(r.member.handle.toLowerCase())));
if (fails) { console.log(`${fails} board check(s) failed`); process.exit(1); }
console.log("all board checks passed");
