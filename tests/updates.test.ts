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

// what the content editor writes: single quotes, long summaries folded over lines, a slug without a date, an empty order
const editor = "---\ntitle: 'It''s here: Epoch tickets'\ndate: 2026-11-01\ntag: Epoch\nsummary: >-\n  A long summary that the editor folds\n  over two lines.\norder:\n---\nBody";
const e = parseUpdate("epoch-tickets.md", editor);
ok("the editor's headers parse (quotes, folded summary, empty order)", e.title === "It's here: Epoch tickets" && e.summary === "A long summary that the editor folds over two lines." && e.order === 0 && e.slug === "epoch-tickets");
ok("a date stays a plain date, not a timestamp", e.date === "2026-11-01");
const table = parseUpdate("t.md", "---\ntitle: T\ndate: 2026-10-02\nsummary: S\n---\n{% table %}\n- When\n- Event\n---\n- 7 Oct\n- [RSVP](https://luma.com/x)\n{% /table %}");
ok("tables the editor saves as {% table %} still become HTML tables", table.html.includes("<table>") && table.html.includes('<a href="https://luma.com/x">RSVP</a>') && !table.html.includes("{%"));
ok("a broken header is explained", throws(() => parseUpdate("x.md", "---\ntitle: [unclosed\n---\nBody"), /header isn't valid/));
if (fails) { console.log(`${fails} updates check(s) failed`); process.exit(1); }
console.log("all updates checks passed");
