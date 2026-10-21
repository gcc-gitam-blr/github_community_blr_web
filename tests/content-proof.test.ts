/* Content edits must never turn CI red. Editors rename events, people and posts in the content editor, and each save
   is a commit on main that CI checks. A test that has one of those names typed in fails the moment someone edits it,
   which looks like the editor broke the site when it didn't. So no test may contain a name an editor can change:
   read it from the content instead (EVENTS, CLUB, TEAM, ...), as tests/certificates.test.ts does. */
import fs from "node:fs";
import path from "node:path";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const json = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));

// what an editor can type in the content editor, long enough not to collide with ordinary words
const editable = new Map<string, string>();
const add = (s: unknown, where: string) => { if (typeof s === "string" && s.trim().length >= 8) editable.set(s.trim(), where); };
for (const e of json("content/club/events.json").events) add(e.title, "an event's title (content/club/events.json)");
for (const p of json("content/club/team.json").team) add(p.name, "a team member's name (content/club/team.json)");
for (const q of json("content/club/faq.json").faq) add(q.q, "an FAQ question (content/club/faq.json)");
add(json("content/club/settings.json").name, "the club's name (content/club/settings.json)");
add(json("content/epoch/settings.json").tagline, "Epoch's tagline (content/epoch/settings.json)");
for (const f of fs.readdirSync("content/updates")) {
  const title = fs.readFileSync(path.join("content/updates", f), "utf8").match(/^title:\s*"?(.*?)"?\s*$/m)?.[1];
  add(title, `an update's title (content/updates/${f})`);
}

const self = "content-proof.test.ts";
const testFiles = [
  ...fs.readdirSync("tests").filter((f) => f.endsWith(".ts") && f !== self).map((f) => `tests/${f}`),
  ...fs.readdirSync("tests/e2e").filter((f) => f.endsWith(".ts")).map((f) => `tests/e2e/${f}`),
];

ok("there are names to look for", editable.size > 5);
const hits: string[] = [];
for (const file of testFiles) {
  const src = fs.readFileSync(file, "utf8");
  for (const [text, where] of editable) if (src.includes(text)) hits.push(`${file} has "${text}" typed in: that's ${where}. Read it from the content instead.`);
}
for (const h of hits) console.log("      " + h);
ok("no test has a name from the content editor typed in", hits.length === 0);

if (fails) { console.log(`${fails} content-proof check(s) failed`); process.exit(1); }
console.log("all content-proof checks passed");
