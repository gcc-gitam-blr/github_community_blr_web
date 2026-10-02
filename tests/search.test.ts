/* Site search: the index covers pages, events, FAQ and Git commands; ranking is predictable. */
import { baseIndex, search, type Entry } from "../lib/search";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const idx: Entry[] = [...baseIndex(), { kind: "Update", title: "Epoch is coming in December", hint: "2 October 2026 · Epoch", href: "/updates/epoch-in-december" }];
const top = (q: string) => search(idx, q)[0];

ok("the index has pages, sections, events, questions and commands", ["Page", "Section", "Event", "Question", "Git command"].every((k) => idx.some((e) => e.kind === k)));
ok("an empty query suggests pages and sections", search(idx, "").every((e) => e.kind === "Page" || e.kind === "Section"));
ok("'learn' finds the Learn hub first", top("learn").href === "/learn");
ok("'merge' finds GIT Merge 26", search(idx, "merge").some((e) => e.title === "GIT Merge 26"));
ok("'stash' finds the git stash command, linked into the cheat sheet", top("stash").kind === "Git command" && top("stash").href.startsWith("/learn?q=git%20stash#cheat"));
ok("every word must match", search(idx, "epoch zzzz").length === 0);
ok("case and punctuation don't matter", top("FAQ!").href === "/#faq");
ok("questions are searchable by their answers", search(idx, "398").some((e) => e.kind === "Question"));
ok("update posts are included", search(idx, "december").some((e) => e.kind === "Update"));
ok("typing part of a word works", search(idx, "contri").some((e) => e.href === "/contribute"));
ok("regex characters in the query are safe", search(idx, "c++ (x)").length >= 0);
ok("results are capped", search(idx, "git", 5).length === 5);

if (fails) { console.log(`${fails} search check(s) failed`); process.exit(1); }
console.log("all search checks passed");
