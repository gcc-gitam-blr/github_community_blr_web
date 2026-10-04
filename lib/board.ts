import { CLUB } from "./config";

/* The contribution board: pull requests members got merged anywhere on public GitHub this club year.
   PRs into a member's own repositories don't count; the point is contributing to other people's projects.
   One GitHub search per group of members, cached for an hour; GITHUB_TOKEN (server-only) raises the rate limit. */
export const BOARD_SINCE = "2026-06-01"; // start of the 2026-27 club year
export interface Member { name: string; handle: string; photo?: string; githubAvatar?: boolean }
export interface MergedPr { id: number; title: string; url: string; repo: string; author: string; merged: string }
export interface Row { member: Member; prs: number; repos: string[]; latest: MergedPr }

/** Everyone on the site with a GitHub handle, once each (team first, then contributors). */
export function boardMembers(people: Member[] = [...CLUB.team, ...CLUB.contributors]): Member[] {
  const seen = new Set<string>();
  return people.filter((p) => p.handle && !seen.has(p.handle.toLowerCase()) && seen.add(p.handle.toLowerCase()));
}

/** Search queries of at most `max` characters (GitHub's limit is 256), each OR-ing a group of authors. */
export function queries(handles: string[], since = BOARD_SINCE, max = 240): string[] {
  const base = `is:pr is:merged merged:>=${since}`, out: string[] = [];
  let q = base;
  for (const h of handles) {
    const part = ` author:${h}`;
    if (q.length + part.length > max && q !== base) { out.push(q); q = base; }
    q += part;
  }
  if (q !== base) out.push(q);
  return out;
}

/** The merged PRs that count: by a member, outside their own repos, each once; newest first. The board and the challenge both use it. */
export function counted(prs: MergedPr[], members: Member[]): MergedPr[] {
  const handles = new Set(members.map((m) => m.handle.toLowerCase()));
  const seen = new Set<number>();
  return prs
    .filter((p) => handles.has(p.author.toLowerCase()) && p.repo.split("/")[0].toLowerCase() !== p.author.toLowerCase() && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => b.merged.localeCompare(a.merged));
}

/** Ranks members by merged PRs outside their own repos (ties: more repos, then most recent); also the latest few merges. */
export function summarise(prs: MergedPr[], members: Member[], recent = 6): { rows: Row[]; recent: MergedPr[] } {
  const byHandle = new Map(members.map((m) => [m.handle.toLowerCase(), m]));
  const counts = counted(prs, members);
  const rows = new Map<string, Row>();
  for (const p of counts) {
    const k = p.author.toLowerCase(), r = rows.get(k);
    if (!r) rows.set(k, { member: byHandle.get(k)!, prs: 1, repos: [p.repo], latest: p });
    else { r.prs++; if (!r.repos.includes(p.repo)) r.repos.push(p.repo); }
  }
  return {
    rows: [...rows.values()].sort((a, b) => b.prs - a.prs || b.repos.length - a.repos.length || b.latest.merged.localeCompare(a.latest.merged)),
    recent: counts.slice(0, recent),
  };
}

interface Raw { id: number; title: string; html_url: string; repository_url: string; user: { login: string } | null; pull_request?: { merged_at: string | null } }

// up to 300 PRs per group of members, so one very active member can't crowd the others out of the first page
async function search(q: string, pages = 3): Promise<MergedPr[] | null> {
  const items: Raw[] = [];
  try {
    for (let page = 1; page <= pages; page++) {
      const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=100&page=${page}`, {
        headers: { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { total_count: number; items?: Raw[] };
      items.push(...(j.items ?? []));
      if (items.length >= j.total_count || !j.items?.length) break;
    }
  } catch { return null; }
  return items.filter((i) => i.user && i.pull_request?.merged_at).map((i) => ({ id: i.id, title: i.title, url: i.html_url, repo: i.repository_url.replace("https://api.github.com/repos/", ""), author: i.user!.login, merged: i.pull_request!.merged_at! }));
}

/* Preview deployments fill an empty board with a sample, so the layout can be judged before members have merges.
   It uses GitHub's mascot accounts, never real members, and never builds into production. Locally: BOARD_SAMPLE=1. */
export const SHOW_SAMPLE = process.env.VERCEL_ENV === "preview" || process.env.BOARD_SAMPLE === "1";
export function sampleBoard(now = new Date()) {
  const who: Member[] = [{ name: "Mona Lisa Octocat", handle: "octocat" }, { name: "Hubot", handle: "hubot" }, { name: "Monalisa", handle: "monalisa" }];
  const work: [string, string, string][] = [
    ["octocat", "first-contributions/first-contributions", "Add Octocat to Contributors list"], ["octocat", "freeCodeCamp/freeCodeCamp", "fix(curriculum): typo in the CSS grid lesson"],
    ["octocat", "mdn/content", "Clarify Array.prototype.at() examples"], ["hubot", "vercel/next.js", "docs: fix broken link in the caching guide"],
    ["hubot", "first-contributions/first-contributions", "Add Hubot to Contributors list"], ["monalisa", "python/cpython", "Docs: correct a parameter name in pathlib"],
  ];
  // dated a few days apart before `now`, so the sample challenge always has someone done, someone halfway and someone starting
  const prs = work.map(([author, repo, title], i) => ({ id: -(i + 1), title, url: `https://github.com/${repo}`, repo, author, merged: new Date(now.getTime() - (1 + i * 3) * 864e5).toISOString() }));
  return { members: who, prs, ...summarise(prs, who) };
}

/** The board, or `ok: false` when GitHub couldn't be reached (the page says so rather than showing an empty board). */
export async function loadBoard() {
  const members = boardMembers();
  const results = await Promise.all(queries(members.map((m) => m.handle)).map(search));
  const prs = results.flatMap((r) => r ?? []);
  return { ok: results.every((r) => r !== null), members, prs, ...summarise(prs, members) };
}
