/* The beginner-issues feed: parsing GitHub's response (fetch is mocked), dropping pull requests, handling errors. */
import { ago, clubIssues, worldIssues } from "../lib/issues";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const realFetch = globalThis.fetch; const calls: string[] = [];
const item = (id: number, extra: object = {}) => ({ id, title: `Issue ${id}`, html_url: `https://github.com/o/r/issues/${id}`, repository_url: "https://api.github.com/repos/o/r", comments: 0, updated_at: new Date().toISOString(), labels: [{ name: "good first issue" }, { name: "docs" }], ...extra });

(async () => {
  globalThis.fetch = (async (u: string) => { calls.push(String(u)); return new Response(JSON.stringify({ items: [item(1), item(2, { pull_request: {} }), item(3)] }), { status: 200 }); }) as typeof fetch;
  const w = await worldIssues();
  ok("pull requests are dropped, issues kept", w.length === 2 && w.every((i) => i.id !== 2));
  ok("repo name is read from the API url", w[0].repo === "o/r" && w[0].labels.includes("docs"));
  ok("the world query asks for open, unassigned, uncommented beginner issues", decodeURIComponent(calls[0]).includes('label:"good first issue"') && decodeURIComponent(calls[0]).includes("no:assignee") && decodeURIComponent(calls[0]).includes("comments:0"));
  await clubIssues();
  ok("the club query is limited to the club's organisation", decodeURIComponent(calls[1]).includes("org:github-community-gitam"));
  globalThis.fetch = (async () => new Response("rate limited", { status: 403 })) as typeof fetch;
  ok("a GitHub error gives an empty list, not a crash", (await worldIssues()).length === 0);
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  ok("a network failure gives an empty list, not a crash", (await worldIssues()).length === 0);
  globalThis.fetch = realFetch;

  const now = Date.parse("2026-10-10T12:00:00Z");
  ok("ago(): today / yesterday / days / months", ago("2026-10-10T01:00:00Z", now) === "today" && ago("2026-10-09T01:00:00Z", now) === "yesterday" && ago("2026-10-05T01:00:00Z", now) === "5 days ago" && ago("2026-07-01T01:00:00Z", now) === "3 mo ago");
  console.log(fails ? `\n${fails} FAILED` : "\nall issues checks passed"); process.exit(fails ? 1 : 0);
})();
