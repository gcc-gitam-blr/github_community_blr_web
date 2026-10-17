import { EMAIL_RE, HANDLE_RE, MIN_FILL_MS, cleanHandle } from "./join";

/* Core-team applications, shared by the form (instant feedback) and /api/apply (the real check). We ask for the least
   we need: name, email, GitHub username, a team preference and two short answers. No phone numbers, ID numbers or
   anything personal beyond that. */
export const TEAMS = ["Events", "Tech", "Design", "Content", "Outreach"] as const;
export const QUESTIONS = [
  { id: "why", label: "Why do you want to join the core team?", hint: "A few sentences is plenty.", required: true, min: 20 },
  { id: "built", label: "Anything you've built, organised or contributed to?", hint: "Optional. Links are welcome.", required: false, min: 0 },
] as const;
export const ANSWER_MAX = 1000;

export interface ApplyInput { campaign: number; name: string; email: string; handle: string; team?: string; answers: Record<string, string>; website?: string; elapsedMs?: number }
export type ApplyResult = { ok: true; status: "created" | "exists" } | { ok: false; error: string; closed?: boolean };
export interface OpenCampaign { id: number; name: string; closesOn: string }

export function validateApplication(i: ApplyInput): string | null {
  if (i.website) return "spam"; // honeypot
  if (i.elapsedMs !== undefined && i.elapsedMs < MIN_FILL_MS) return "spam";
  if (!Number.isInteger(i.campaign) || i.campaign < 1) return "Applications aren't open right now.";
  const name = (i.name ?? "").trim();
  if (name.length < 2 || name.length > 80) return "Please enter your name.";
  if (!EMAIL_RE.test((i.email ?? "").trim())) return "That email doesn't look right.";
  if (!HANDLE_RE.test(cleanHandle(i.handle ?? ""))) return "Add your GitHub username — we look at it when choosing the team.";
  if (i.team && !TEAMS.some((t) => t === i.team)) return "Pick one of the teams, or leave it blank.";
  const a = i.answers ?? {};
  if (Object.keys(a).some((k) => !QUESTIONS.some((q) => q.id === k))) return "Something went wrong with the form. Please reload the page.";
  for (const q of QUESTIONS) {
    const v = (a[q.id] ?? "").trim();
    if (q.required && v.length < q.min) return `Tell us a little more: ${q.label.toLowerCase()}`;
    if (v.length > ANSWER_MAX) return `Please keep each answer under ${ANSWER_MAX} characters.`;
  }
  return null;
}

/** The answers as stored: trimmed, and only the ones that were filled in. */
export const cleanAnswers = (a: Record<string, string>) => Object.fromEntries(QUESTIONS.map((q) => [q.id, (a?.[q.id] ?? "").trim()] as const).filter(([, v]) => v));
