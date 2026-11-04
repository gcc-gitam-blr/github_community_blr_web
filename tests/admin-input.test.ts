/* The admin's forms take what organisers type or paste: a GitHub username as a link, a one-letter name, a page address
   pasted as the whole link. Each is tidied before it reaches the database, so it saves instead of being refused. */
import { pageAddress } from "../lib/admin/client";
import { parseMembersCsv } from "../lib/admin/members";
import { tidyName } from "../lib/join";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

ok("a page address pasted as the whole link is just its last part", ["https://www.gccgitamblr.club/events/git-merge-26", "https://www.gccgitamblr.club/events/git-merge-26/", "gccgitamblr.club/events/git-merge-26?ref=x#top", " git-merge-26 ", "Git Merge 26"].every((s) => pageAddress(s) === "git-merge-26"));
ok("a policy's short name typed as words becomes one", pageAddress("Code of Conduct") === "code-of-conduct" && pageAddress("") === "");
ok("a one-letter name is kept, an empty one stays empty (so it's still asked for)", tidyName("X") === "X." && tidyName("   ") === "" && tidyName("  Ada   Lovelace ") === "Ada Lovelace");
const csv = parseMembersCsv("name,email,github\nX,x@gitam.in,https://github.com/xan\n,empty@gitam.in,\n");
ok("a members spreadsheet keeps a one-letter name and reads a profile link as the username", csv.rows[0].name === "X." && csv.rows[0].handle === "xan" && csv.rows[1].name === "");

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall admin-input checks passed");
