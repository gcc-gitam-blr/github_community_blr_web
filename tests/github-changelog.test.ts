/* The GitHub Changelog feed: parsed into headline, date, one-line summary and a topic label.
   Uses a small hand-written feed in the same shape as github.blog's (WordPress RSS). Set CHANGELOG_XML to a downloaded feed to print a real one. */
import fs from "node:fs";
import { decode, parseChangelog, topicOf } from "../lib/github-changelog";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const item = (title: string, slug: string, date: string, summary: string, link = `https://github.blog/changelog/${slug}`) => `<item>
    <title>${title}</title>
    <link>${link}</link>
    <dc:creator><![CDATA[Someone]]></dc:creator>
    <pubDate>${date}</pubDate>
    <description><![CDATA[<p>${summary}&#8230;</p>
<p>The post <a href="${link}">${title}</a> appeared first on <a href="https://github.blog">The GitHub Blog</a>.</p>
]]></description>
    <content:encoded><![CDATA[<html><body><p>Full post body that we never show.</p></body></html>]]></content:encoded>
  </item>`;
const xml = `<?xml version="1.0"?><rss><channel><title>GitHub Changelog</title>
  ${item("Copilot code review now suggests fixes", "2026-10-01-copilot-review", "Thu, 01 Oct 2026 19:57:39 +0000", "Copilot can now suggest fixes in reviews. Try it on any pull request")}
  ${item("Dependabot &amp; secret scanning for forks", "2026-09-30-dependabot", "Wed, 30 Sep 2026 10:00:00 +0000", "Forks now get alerts &#8217;right away&#8217;. More below")}
  ${item("Something else entirely", "2026-09-29-x", "Tue, 29 Sep 2026 10:00:00 +0000", "A very long sentence ".repeat(20))}
  ${item("Spoofed entry", "x", "Tue, 29 Sep 2026 10:00:00 +0000", "Links elsewhere", "https://evil.example/changelog/x")}
  ${item("No date", "2026-09-28-y", "not a date", "Missing date")}
</channel></rss>`;

const es = parseChangelog(xml);
ok("entries are parsed in feed order", es.length === 3 && es[0].title === "Copilot code review now suggests fixes");
ok("dates become YYYY-MM-DD", es[0].date === "2026-10-01" && es[1].date === "2026-09-30");
ok("summary is the first sentence, without the 'appeared first' line", es[0].summary === "Copilot can now suggest fixes in reviews.");
ok("HTML entities are decoded", es[1].title === "Dependabot & secret scanning for forks" && es[1].summary === "Forks now get alerts ’right away’.");
ok("long summaries are cut with an ellipsis", es[2].summary.length <= 180 && es[2].summary.endsWith("…"));
ok("only links to github.blog/changelog are kept", es.every((e) => e.url.startsWith("https://github.blog/changelog/")));
ok("entries without a date are dropped", !es.some((e) => e.title === "No date"));
ok("the limit is respected", parseChangelog(xml, 2).length === 2);
ok("garbage gives an empty list, not a crash", parseChangelog("<html>nope</html>").length === 0);
ok("topics come from the headline", topicOf("GitHub Copilot can now use agents") === "Copilot" && topicOf("Rate limits for private vulnerability reports") === "Security" && topicOf("Faster Actions runners") === "Actions" && topicOf("New look for the dashboard") === "Platform");
ok("numeric and named entities decode", decode("&#8230; &#x2019; &amp; &hellip;") === "… ’ & …");

if (process.env.CHANGELOG_XML) for (const e of parseChangelog(fs.readFileSync(process.env.CHANGELOG_XML, "utf8"))) console.log(" ", e.date, e.topic.padEnd(17), e.title, "—", e.summary);
if (fails) { console.log(`${fails} changelog check(s) failed`); process.exit(1); }
console.log("all changelog checks passed");
