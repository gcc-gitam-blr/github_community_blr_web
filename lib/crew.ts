/* The club's technical roles, modelled on how engineering teams work. Each has levels like SD1/SD2/SD3:
   I is starting out, II has some experience, III is the most experienced. People's roles live in lib/config.ts (team[].crew). */
export type CrewId = "custodian" | "gatekeeper" | "scout" | "pipeline" | "security" | "alchemist" | "explorer" | "forge";

export const CREWS = [
  { name: "Architecture & Strategy", tone: "purple" },
  { name: "Automation & Pipeline", tone: "blue" },
  { name: "Execution & Onboarding", tone: "red" },
] as const;

export const ROLES: Record<CrewId, { title: string; crew: 0 | 1 | 2; industry: string; access: string; what: string }> = {
  custodian: { title: "Git Custodian", crew: 0, industry: "Repository health / Git architect", access: "Maintain",
    what: "Designs the branching strategy for the club's big projects, writes the PR templates and .gitignore files, and untangles the merge conflicts newer members run into." },
  gatekeeper: { title: "Code Gatekeeper", crew: 0, industry: "Senior code reviewer / QA lead", access: "Write · Maintain",
    what: "The last line of defence for the codebase: reviews incoming pull requests against the style guide, suggests improvements, and decides when code is clean enough to merge." },
  scout: { title: "Tech Scout", crew: 0, industry: "Technology strategist / stack cartographer", access: "Triage",
    what: "Watches what's new and relevant in tech — APIs, open-source trends, frameworks — and turns it into project blueprints: two or three realistic options each semester, with the stack each one needs." },
  pipeline: { title: "Pipeline Architect", crew: 1, industry: "DevOps / CI-CD engineer", access: "Maintain",
    what: "Writes the GitHub Actions workflows that run tests, check links and lint every pull request automatically." },
  security: { title: "Secrets & Security Officer", crew: 1, industry: "DevSecOps / AppSec engineer", access: "Maintain · Admin",
    what: "Watches security alerts, makes sure nobody commits API keys or passwords, and keeps dependencies patched with Dependabot." },
  alchemist: { title: "Issue Alchemist", crew: 2, industry: "Technical product owner / triage lead", access: "Triage",
    what: "Turns vague project ideas into clear, bite-sized issues, and keeps good-first-issue tasks ready on the Projects board for new members." },
  explorer: { title: "Stack Explorer", crew: 2, industry: "R&D / open-source scout", access: "Write",
    what: "Builds small proof-of-concept apps to try new frameworks and APIs before a project starts, and finds open-source projects members can contribute to." },
  forge: { title: "Onboarding Forge", crew: 2, industry: "Developer advocate / code sherpa", access: "Maintain (practice repo) · Triage",
    what: "Bridges the gap between knowing a little code and a first real contribution: runs a practice repository with gentle starter issues and walks beginners through cloning, branching and their first pull request." },
};

export const LEVELS = ["I", "II", "III"] as const;
export type CrewRole = { role: CrewId; level: 1 | 2 | 3 };
export const roleLabel = (r: CrewRole) => `${ROLES[r.role].title} ${LEVELS[r.level - 1]}`;
