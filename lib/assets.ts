/* Wording for the asset registry's warnings, shared by the admin page and the Monday digest. The database decides what
   is a problem (asset_problems in supabase/schema.sql); this only says it in plain words. */
export interface AssetProblem { id: number; name: string; problem: "no_owner" | "no_backup" | "owner_access_ended" | "owner_access_ends" | "review_overdue"; days: number | null }

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
export const problemText = (p: AssetProblem) => {
  switch (p.problem) {
    case "no_owner": return "has no owner yet";
    case "no_backup": return "has no backup owner";
    case "owner_access_ended": return "its owner no longer has access: choose a new owner";
    case "owner_access_ends": return (p.days ?? 0) <= 0 ? "its owner's access ends today" : `its owner's access ends in ${days(p.days ?? 0)}`;
    case "review_overdue": return `its review is ${days(p.days ?? 0)} overdue`;
  }
};

/** The problems grouped by asset, most serious first, for the digest and the page. */
export function groupProblems(list: AssetProblem[]) {
  const rank: Record<AssetProblem["problem"], number> = { owner_access_ended: 0, no_owner: 1, owner_access_ends: 2, no_backup: 3, review_overdue: 4 };
  const by = new Map<number, { id: number; name: string; problems: AssetProblem[] }>();
  for (const p of list) { const g = by.get(p.id) ?? { id: p.id, name: p.name, problems: [] }; g.problems.push(p); by.set(p.id, g); }
  return [...by.values()].map((g) => ({ ...g, problems: g.problems.sort((a, b) => rank[a.problem] - rank[b.problem]) }))
    .sort((a, b) => rank[a.problems[0].problem] - rank[b.problems[0].problem] || a.name.localeCompare(b.name));
}
