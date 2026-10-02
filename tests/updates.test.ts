/* Club updates: every post in content/updates parses, and bad headers are caught with a clear message. */
import { getUpdates, parseUpdate } from "../lib/updates";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const throws = (f: () => unknown, re: RegExp) => { try { f(); return false; } catch (e) { return re.test((e as Error).message); } };

const posts = getUpdates();
ok("every post in content/updates parses", posts.length >= 4);
ok("slugs drop the date and are unique", posts.every((p) => !/^\d/.test(p.slug)) && new Set(posts.map((p) => p.slug)).size === posts.length);
ok("newest first, then by order", posts.every((p, i) => !i || posts[i - 1].date > p.date || (posts[i - 1].date === p.date && posts[i - 1].order >= p.order)));
ok("the 7 October session is pinned first", posts[0].slug === "first-session-7-october");
ok("Markdown becomes HTML (tables, links, lists)", posts.some((p) => p.html.includes("<table>")) && posts.every((p) => p.html.includes("<a href=")));

const good = "---\ntitle: Hi\ndate: 2026-10-02\nsummary: S\n---\nBody **bold**";
const p = parseUpdate("2026-10-02-hi.md", good);
ok("a minimal post works, with defaults", p.slug === "hi" && p.tag === "News" && p.order === 0 && p.html.includes("<strong>bold</strong>"));
ok("quoted titles are unquoted", parseUpdate("2026-10-02-q.md", good.replace("title: Hi", 'title: "A: B"')).title === "A: B");
ok("a missing header is explained", throws(() => parseUpdate("x.md", "no header"), /--- header/));
ok("a missing summary is explained", throws(() => parseUpdate("x.md", good.replace("summary: S\n", "")), /needs a summary/));
ok("a wrong date format is explained", throws(() => parseUpdate("x.md", good.replace("2026-10-02", "2 Oct")), /date must look like/));

if (fails) { console.log(`${fails} updates check(s) failed`); process.exit(1); }
console.log("all updates checks passed");
