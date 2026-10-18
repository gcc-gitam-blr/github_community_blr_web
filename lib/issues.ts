import { CLUB } from "./config";

/* Beginner-friendly issues from GitHub's search API, cached for 30 minutes by Next.js.
   Optional GITHUB_TOKEN (server-only) raises GitHub's rate limit; the page works without it. */
export interface Issue { id: number; title: string; url: string; repo: string; comments: number; updated: string; labels: string[] }

interface Raw { id: number; title: string; html_url: string; repository_url: string; comments: number; updated_at: string; labels: { name: string }[]; pull_request?: unknown }

async function search(q: string, perPage: number): Promise<Issue[]> {
  try {
    const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${perPage}`, {
      headers: { Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { items?: Raw[] };
    return (j.items ?? []).filter((i) => !i.pull_request).map((i) => ({ id: i.id, title: i.title, url: i.html_url, repo: i.repository_url.replace("https://api.github.com/repos/", ""), comments: i.comments, updated: i.updated_at, labels: i.labels.map((l) => l.name) }));
  } catch { return []; }
}

const GFI = 'label:"good first issue" state:open is:issue no:assignee';
export const clubIssues = () => (CLUB.githubOrg ? search(`org:${CLUB.githubOrg} ${GFI}`, 8) : Promise.resolve([]));
/** A short, varied list a beginner here can read: titles in English (mostly Latin letters), and at most two from any one
    repository, so a single busy project can't fill it. */
export function pickIssues(list: Issue[], n = 6, perRepo = 2): Issue[] {
  const latin = (t: string) => { const letters = t.match(/\p{L}/gu) ?? []; return letters.length > 0 && letters.filter((c) => /[A-Za-z]/.test(c)).length / letters.length >= 0.9; };
  const seen = new Map<string, number>(), out: Issue[] = [];
  for (const i of list) {
    if (out.length >= n || !latin(i.title) || (seen.get(i.repo) ?? 0) >= perRepo) continue;
    seen.set(i.repo, (seen.get(i.repo) ?? 0) + 1); out.push(i);
  }
  return out;
}
/** Fresh, unclaimed beginner issues across GitHub, with no comments yet (so nobody is already on it): six, picked from 40. */
export const worldIssues = async () => pickIssues(await search(`${GFI} comments:0`, 40));

export const ago = (iso: string, now = Date.now()) => {
  const d = Math.floor((now - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d < 30 ? `${d} days ago` : `${Math.floor(d / 30)} mo ago`;
};
