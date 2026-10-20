import { EMAIL_RE, HANDLE_RE, MIN_FILL_MS, TOO_FAST, cleanHandle } from "./join";

/* Core-team applications, shared by the form (instant feedback) and /api/apply (the real check; the database checks
   once more). Every round has its own form, built in Admin → Recruitment like a Google Form. Name, email and GitHub
   username are always asked; the rest is the round's questions. We ask for the least we need: no phone numbers, ID
   numbers or anything personal beyond that. */
export type QuestionType = "short" | "long" | "choice" | "checkboxes" | "dropdown" | "scale" | "link";
export interface Question { id: string; type: QuestionType; label: string; help?: string; required: boolean; options?: string[] }
export type Answer = string | string[];

export const QUESTION_TYPES: { id: QuestionType; label: string; hint: string }[] = [
  { id: "short", label: "Short answer", hint: "One line" },
  { id: "long", label: "Paragraph", hint: "A few sentences" },
  { id: "choice", label: "Multiple choice", hint: "Pick one" },
  { id: "checkboxes", label: "Checkboxes", hint: "Pick any" },
  { id: "dropdown", label: "Dropdown", hint: "Pick one, from a list" },
  { id: "scale", label: "Scale 1 to 5", hint: "How much, how sure…" },
  { id: "link", label: "Link", hint: "A portfolio, a repository…" },
];
export const hasOptions = (t: QuestionType) => t === "choice" || t === "checkboxes" || t === "dropdown";
export const LIMITS = { questions: 20, label: 200, help: 300, options: 20, option: 100, teams: 12, team: 40, intro: 1000, short: 300, answer: 2000 } as const;

/** The form every round starts with (and the one rounds made before forms existed still use). */
export const DEFAULT_QUESTIONS: Question[] = [
  { id: "why", type: "long", label: "Why do you want to join the core team?", help: "A few sentences is plenty.", required: true },
  { id: "built", type: "long", label: "Anything you've built, organised or contributed to?", help: "Optional. Links are welcome.", required: false },
];
export const DEFAULT_TEAMS = ["Events", "Tech", "Design", "Content", "Outreach"];

export interface RoundForm { intro: string | null; questions: Question[]; teams: string[] }
export interface OpenCampaign extends RoundForm { id: number; name: string; closesOn: string }
export interface ApplyInput { campaign: number; name: string; email: string; handle: string; team?: string; answers: Record<string, Answer>; website?: string; elapsedMs?: number }
export type ApplyResult = { ok: true; status: "created" | "exists" } | { ok: false; error: string; closed?: boolean };

const isLink = (s: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s);
const empty = (v: Answer | undefined) => v === undefined || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");

/** Name, email, GitHub username and the spam checks: the same for every round. */
export function basicProblem(i: ApplyInput): string | null {
  if (i.website) return "spam"; // honeypot
  if (i.elapsedMs !== undefined && i.elapsedMs < MIN_FILL_MS) return TOO_FAST; // said, not dropped: a fast human just sends again
  if (!Number.isInteger(i.campaign) || i.campaign < 1) return "Applications aren't open right now.";
  const name = (i.name ?? "").trim();
  if (name.length < 2 || name.length > 80) return "Please enter your name.";
  if (!EMAIL_RE.test((i.email ?? "").trim())) return "That email doesn't look right.";
  if (!HANDLE_RE.test(cleanHandle(i.handle ?? ""))) return "Add your GitHub username: we look at it when choosing the team.";
  return null;
}

/** The answers, against this round's questions: every required one answered, each in the shape its type asks for. */
export function answersProblem(i: ApplyInput, form: RoundForm): string | null {
  if (i.team && !form.teams.includes(i.team)) return "Pick one of the teams, or leave it blank.";
  const a = i.answers ?? {};
  if (Object.keys(a).some((k) => !form.questions.some((q) => q.id === k))) return "Something went wrong with the form. Please reload the page.";
  for (const q of form.questions) {
    const v = a[q.id];
    if (empty(v)) { if (q.required) return `Please answer: ${q.label}`; continue; }
    if (q.type === "checkboxes") {
      if (!Array.isArray(v) || v.some((x) => !q.options?.includes(x))) return `Please pick from the options given: ${q.label}`;
      continue;
    }
    if (typeof v !== "string") return "Something went wrong with the form. Please reload the page.";
    const t = v.trim();
    if ((q.type === "choice" || q.type === "dropdown") && !q.options?.includes(t)) return `Please pick one of the options: ${q.label}`;
    if (q.type === "scale" && !/^[1-5]$/.test(t)) return `Pick a number from 1 to 5: ${q.label}`;
    if (q.type === "link" && !isLink(t)) return `That link doesn't look right: ${q.label}`;
    const max = q.type === "short" || q.type === "link" ? LIMITS.short : LIMITS.answer;
    if (t.length > max) return `Please keep each answer under ${max} characters: ${q.label}`;
    if (q.type === "long" && q.required && t.length < 10) return `Tell us a little more: ${q.label}`;
  }
  return null;
}

export const validateApplication = (i: ApplyInput, form: RoundForm) => basicProblem(i) ?? answersProblem(i, form);

/** The answers as stored: trimmed, links given https://, unknown choices dropped, empty ones left out. */
export const cleanAnswers = (a: Record<string, Answer>, questions: Question[]): Record<string, Answer> => Object.fromEntries(questions.flatMap((q): [string, Answer][] => {
  const v = a?.[q.id];
  if (Array.isArray(v)) { const picked = v.filter((x) => q.options?.includes(x)); return picked.length ? [[q.id, picked]] : []; }
  let t = typeof v === "string" ? v.trim() : "";
  if (t && q.type === "link" && !/^https?:\/\//i.test(t)) t = `https://${t}`;
  return t ? [[q.id, t]] : [];
}));

/** An organiser's form, checked before it is saved (the database checks it again). Null when it's fine. */
export function formProblem(f: RoundForm): string | null {
  if ((f.intro ?? "").length > LIMITS.intro) return `Keep the introduction under ${LIMITS.intro} characters.`;
  if (!f.questions.length || f.questions.length > LIMITS.questions) return `A form has 1 to ${LIMITS.questions} questions.`;
  for (const [n, q] of f.questions.entries()) {
    const at = `Question ${n + 1}`;
    if (q.label.trim().length < 3 || q.label.length > LIMITS.label) return `${at} needs a question of 3 to ${LIMITS.label} characters.`;
    if ((q.help ?? "").length > LIMITS.help) return `${at}: keep the help text under ${LIMITS.help} characters.`;
    if (hasOptions(q.type)) {
      const o = q.options ?? [];
      if (o.length < 2 || o.length > LIMITS.options) return `${at} needs 2 to ${LIMITS.options} options, one per line.`;
      if (o.some((x) => !x.trim() || x.length > LIMITS.option)) return `${at}: each option is 1 to ${LIMITS.option} characters.`;
      if (new Set(o).size !== o.length) return `${at} has the same option twice.`;
    }
  }
  if (f.teams.length > LIMITS.teams || f.teams.some((t) => !t.trim() || t.length > LIMITS.team)) return `Up to ${LIMITS.teams} teams, each 1 to ${LIMITS.team} characters.`;
  return null;
}

/** A new question's id: short, and unlikely to repeat within a form. */
export const newQuestionId = () => `q${Math.random().toString(36).slice(2, 8)}`;

/** A question's answer as text, for the table and the CSV. */
export const answerText = (v: Answer | undefined) => (Array.isArray(v) ? v.join("; ") : v ?? "");
