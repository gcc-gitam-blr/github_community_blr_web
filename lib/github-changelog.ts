/* What GitHub shipped lately: headlines from the public GitHub Changelog feed (github.blog/changelog/feed).
   We show the title, date and a one-line summary and link to GitHub's own post — nothing is copied beyond that.
   Fetched on the server and cached for an hour; if the feed is down, it returns [] and the section hides. */
export interface ChangelogEntry { title: string; url: string; date: string; summary: string; topic: string }

export const CHANGELOG_URL = "https://github.blog/changelog/";
const FEED = "https://github.blog/changelog/feed/";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—" };
export const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
  e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m);
const text = (html: string) => decode(html.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (item: string, name: string) => item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "";

// a label like GitHub's own changelog uses, guessed from the headline
const TOPICS: [RegExp, string][] = [
  [/copilot|\bai\b|agent|model/i, "Copilot"],
  [/secur|vulnerab|secret|dependabot|codeql|advisor|code scanning/i, "Security"],
  [/actions|workflow|runner|\bci\b/i, "Actions"],
  [/codespace/i, "Codespaces"],
  [/pull request|\bprs?\b|review|merge/i, "Pull requests"],
  [/issue|project|discussion/i, "Issues & Projects"],
  [/package|registry|npm|container/i, "Packages"],
  [/\bapi\b|graphql|webhook|cli\b/i, "APIs & CLI"],
];
export const topicOf = (title: string) => TOPICS.find(([re]) => re.test(title))?.[1] ?? "Platform";

/** The first sentence of the summary, without WordPress's "The post … appeared first on …" line. */
function summarise(description: string) {
  const s = text(description.replace(/<p>The post [\s\S]*?<\/p>/i, "")).replace(/…$|\.\.\.$/, "").trim();
  const first = s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s + "…"; // GitHub cuts some summaries mid-sentence
  return first.length > 180 ? first.slice(0, 177).replace(/\s+\S*$/, "") + "…" : first;
}

export function parseChangelog(xml: string, limit = 12): ChangelogEntry[] {
  return xml.split("<item>").slice(1).map((item) => {
    const url = text(tag(item, "link"));
    const title = text(tag(item, "title"));
    const when = new Date(text(tag(item, "pubDate")));
    return { title, url, date: isNaN(+when) ? "" : when.toISOString().slice(0, 10), summary: summarise(tag(item, "description")), topic: topicOf(title) };
  }).filter((e) => e.title && e.date && e.url.startsWith(CHANGELOG_URL)).slice(0, limit); // only ever link to GitHub's own changelog
}

export async function getChangelog(limit = 12): Promise<ChangelogEntry[]> {
  try {
    const r = await fetch(FEED, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000), headers: { "User-Agent": "github-community-blr (club website)" } });
    return r.ok ? parseChangelog(await r.text(), limit) : [];
  } catch { return []; }
}
