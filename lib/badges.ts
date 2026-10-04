import { counted, type Member, type MergedPr } from "./board";
import { challengeProgress, type Challenge } from "./challenge";

/* Badges: earned from real merged pull requests (the board's counting: other people's projects only), never awarded by hand.
   Each one says how it was earned, so a badge on a profile is something you can check. */
export type BadgeId = "first-merge" | "five-merged" | "ten-merged" | "three-projects" | "challenge";
export interface Badge { id: BadgeId; name: string; how: string }

export const BADGES: Record<BadgeId, Badge> = {
  "first-merge": { id: "first-merge", name: "First merge", how: "Got a pull request merged into someone else's project." },
  "five-merged": { id: "five-merged", name: "Five merged", how: "Five pull requests merged into other people's projects." },
  "ten-merged": { id: "ten-merged", name: "Ten merged", how: "Ten pull requests merged into other people's projects." },
  "three-projects": { id: "three-projects", name: "Three projects", how: "Merged into three different projects." },
  challenge: { id: "challenge", name: "Challenge finisher", how: "Reached the goal of the club's contribution challenge." },
};

/** The badges someone has earned, from their counted merges (and whether they finished the current challenge). */
export function badgesFor(prs: MergedPr[], finishedChallenge = false): Badge[] {
  const repos = new Set(prs.map((p) => p.repo.toLowerCase())).size;
  const ids: BadgeId[] = [];
  if (prs.length >= 1) ids.push("first-merge");
  if (prs.length >= 5) ids.push("five-merged");
  if (prs.length >= 10) ids.push("ten-merged");
  if (repos >= 3) ids.push("three-projects");
  if (finishedChallenge) ids.push("challenge");
  return ids.map((id) => BADGES[id]);
}

/** Everyone's badges at once, keyed by lower-case GitHub handle. A challenge counts once it has finishers. */
export function badgesByMember(prs: MergedPr[], members: Member[], challenge?: Challenge): Map<string, Badge[]> {
  const finished = new Set(challenge ? challengeProgress(prs, members, challenge).done.map((d) => d.member.handle.toLowerCase()) : []);
  return new Map(members.map((m) => [m.handle.toLowerCase(), badgesFor(counted(prs, [m]), finished.has(m.handle.toLowerCase()))]));
}
