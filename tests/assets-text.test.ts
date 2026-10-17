/* The plain-words text for asset warnings. */
import { groupProblems, problemText, type AssetProblem } from "../lib/assets";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const p = (problem: AssetProblem["problem"], days: number | null = null, id = 1, name = "Thing"): AssetProblem => ({ id, name, problem, days });
ok("each problem has a sentence", problemText(p("no_owner")) === "has no owner yet" && problemText(p("no_backup")) === "has no backup owner" && problemText(p("owner_access_ended")).includes("choose a new owner"));
ok("days are counted and pluralised", problemText(p("owner_access_ends", 1)) === "its owner's access ends in 1 day" && problemText(p("owner_access_ends", 9)) === "its owner's access ends in 9 days" && problemText(p("review_overdue", 2)) === "its review is 2 days overdue");
ok("an access ending today says today", problemText(p("owner_access_ends", 0)) === "its owner's access ends today");
const g = groupProblems([p("no_backup", null, 1, "B"), p("review_overdue", 3, 1, "B"), p("no_owner", null, 2, "A"), p("owner_access_ended", null, 3, "C")]);
ok("problems are grouped by asset and ordered by seriousness", g.length === 3 && g[0].name === "C" && g[1].name === "A" && g[2].name === "B" && g[2].problems.map((x) => x.problem).join() === "no_backup,review_overdue");
console.log(fails ? `\n${fails} FAILED` : "\nall asset text checks passed"); process.exit(fails ? 1 : 0);
