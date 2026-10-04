import raw from "@/content/club/challenge.json";
import { counted, type Member, type MergedPr } from "./board";

/* A contribution challenge on the board, like "merge 4 pull requests in October". Set in the content editor
   (content/club/challenge.json); empty = no challenge. It counts exactly like the board (a member's merged PRs into
   other people's projects), by the day each PR was merged in India (IST), from the first day to the last, both included. */
export interface Challenge { name: string; from: string; to: string; goal: number; description?: string }
type Raw = { name?: string | null; from?: string | null; to?: string | null; goal?: number | null; description?: string | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const SHOW_AFTER_DAYS = 14; // a finished challenge stays up for two weeks, so the people who made it are seen

/** The challenge, or undefined when any of name, dates or goal is missing (or the dates are the wrong way round). */
export function readChallenge(r: Raw = raw): Challenge | undefined {
  const name = r.name?.trim(), goal = r.goal ?? 0;
  if (!name || !r.from || !r.to || !DAY.test(r.from) || !DAY.test(r.to) || r.to < r.from || !Number.isInteger(goal) || goal < 1) return undefined;
  return { name, from: r.from, to: r.to, goal, description: r.description?.trim() || undefined };
}
export const CHALLENGE = readChallenge();

/** The day (YYYY-MM-DD) an instant falls on in India. IST is UTC+5:30 all year, so a fixed offset is exact. */
export const istDay = (t: string | Date) => new Date(new Date(t).getTime() + 330 * 60_000).toISOString().slice(0, 10);
const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5); // whole days from b to a

export type ChallengeState = "upcoming" | "on" | "finished" | "over";
export function challengeState(c: Challenge, now = new Date()): ChallengeState {
  const today = istDay(now);
  if (today < c.from) return "upcoming";
  if (today <= c.to) return "on";
  return days(today, c.to) <= SHOW_AFTER_DAYS ? "finished" : "over";
}
/** Days left including today: 1 on the last day. */
export const daysLeft = (c: Challenge, now = new Date()) => Math.max(0, days(c.to, istDay(now)) + 1);

export interface Progress { member: Member; merged: number; /** when the PR that reached the goal was merged */ reachedAt?: string; latest: MergedPr }

/** Who is how far: people who reached the goal (first to get there first), then everyone else on the way (most merged first). */
export function challengeProgress(prs: MergedPr[], members: Member[], c: Challenge): { done: Progress[]; going: Progress[] } {
  const byHandle = new Map(members.map((m) => [m.handle.toLowerCase(), m]));
  const mine = new Map<string, MergedPr[]>();
  for (const p of counted(prs, members)) {
    const d = istDay(p.merged);
    if (d < c.from || d > c.to) continue;
    const k = p.author.toLowerCase();
    mine.set(k, [...(mine.get(k) ?? []), p]);
  }
  const all: Progress[] = [...mine].map(([k, list]) => ({ member: byHandle.get(k)!, merged: list.length, reachedAt: list[list.length - c.goal]?.merged, latest: list[0] })); // list is newest first
  return {
    done: all.filter((p) => p.reachedAt).sort((a, b) => a.reachedAt!.localeCompare(b.reachedAt!)),
    going: all.filter((p) => !p.reachedAt).sort((a, b) => b.merged - a.merged || b.latest.merged.localeCompare(a.latest.merged)),
  };
}

/* Preview deployments only (with the sample board): a labelled sample challenge around today, so the layout can be judged. */
export function sampleChallenge(now = new Date()): Challenge {
  return { name: "Sample challenge", from: istDay(new Date(now.getTime() - 20 * 864e5)), to: istDay(new Date(now.getTime() + 10 * 864e5)), goal: 3, description: "A made-up challenge for preview deployments: three merged pull requests in a month." };
}
