/* The project hub's shared words: the areas people can pick, and the limits. The database holds the same list
   (domain_list() in supabase/schema.sql) and tests/projects.test.ts checks the two agree: change both together. */
export const DOMAINS = [
  { id: "web", label: "Web apps" },
  { id: "mobile", label: "Mobile apps" },
  { id: "ai-ml", label: "AI & machine learning" },
  { id: "data", label: "Data & analytics" },
  { id: "cloud-devops", label: "Cloud & DevOps" },
  { id: "security", label: "Security" },
  { id: "game-dev", label: "Games" },
  { id: "design-ux", label: "Design & UX" },
  { id: "open-source", label: "Open source" },
  { id: "hardware-iot", label: "Hardware & IoT" },
  { id: "other", label: "Something else" },
] as const;
export type DomainId = (typeof DOMAINS)[number]["id"];
export const domainLabel = (id: string) => DOMAINS.find((d) => d.id === id)?.label ?? id;

export const HOURS = [{ id: "1-2", label: "1–2 hours a week" }, { id: "3-5", label: "3–5 hours a week" }, { id: "6+", label: "6 or more hours a week" }] as const;
export const IDEA_STATUS = { idea: "Idea", forming: "Forming a team", building: "Building", shipped: "Shipped", archived: "Archived" } as const;
export type IdeaStatus = keyof typeof IDEA_STATUS;
export const LIMITS = { domainsMember: 5, domainsIdea: 3, skills: 8, skillMax: 24, wants: 280, title: 100, summary: 600, message: 300, teamMin: 2, teamMax: 12 } as const;

/** Skills as typed ("React, node.js ,  Python") → tidy tags, in the same shape the database accepts. Returns null if one is not allowed. */
export function parseSkills(text: string): string[] | null {
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (!/^[a-z0-9][a-z0-9+#. -]{1,23}$/.test(t)) return null;
    if (!out.includes(t)) out.push(t);
  }
  return out.length <= LIMITS.skills ? out : null;
}
export const skillsText = (skills: string[]) => skills.join(", ");
/** A project repository must be a github.com/owner/repo address. */
export const REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/i;
