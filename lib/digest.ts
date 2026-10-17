import { CLUB } from "./config";
import { KINDS } from "./contact";
import { groupProblems, problemText, type AssetProblem } from "./assets";
import { EMAIL_RE } from "./join";

/* The Monday email to organisers: what happened on the site in the past 7 days.
   Built from plain rows so it can be tested without a database; app/api/cron/digest fetches the rows and sends it. */
export interface DigestRows {
  signups: { handle: string; created_at: string }[];
  messages: { kind: string }[];
  feedback: { event: string; rating: number }[];
  /** appointment_warnings() from the database: how many admins are active, and whose access ends within 14 days */
  access?: { active_admins: number; ending: { handle: string; role: string; days_left: number }[] };
  /** task_warnings() from the database: open tasks past their date, and open tasks whose owner no longer has access */
  tasks?: { overdue: { id: number; title: string; owner: string; days: number }[]; orphaned: { id: number; title: string; owner: string }[] };
  /** asset_problems() from the database: assets with no owner or backup, owners losing access, reviews overdue */
  assets?: AssetProblem[];
  /** policy_reviews_due() from the database: policies whose latest version is past its review date */
  policies?: { id: number; title: string; days: number }[];
}
export interface Digest {
  from: string; to: string; // the week, as YYYY-MM-DD in India
  signups: { count: number; first: string[] }; // the first few handles, oldest first
  messages: { label: string; count: number }[];
  feedback: { event: string; average: number; count: number }[];
  /** only when something needs doing: fewer than MIN_ADMINS active admins, or access ending soon */
  access: { activeAdmins: number; tooFewAdmins: boolean; ending: { handle: string; role: string; daysLeft: number }[] } | null;
  /** only when something needs doing */
  tasks: { overdue: { title: string; owner: string; days: number }[]; orphaned: { title: string; owner: string }[] } | null;
  /** only when an asset needs attention: its name and what is wrong, most serious first */
  assets: { name: string; what: string }[] | null;
  /** only when a policy's review date has passed */
  policies: { title: string; days: number }[] | null;
}

export const MIN_ADMINS = 2; // at least two people can always manage access (and the last one is never removed)

export const FIRST_HANDLES = 5;
const istDay = (t: Date) => new Date(t.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** The summary, or null when nothing happened (then no email goes out). */
export function buildDigest(rows: DigestRows, now = new Date()): Digest | null {
  const a = rows.access, tooFewAdmins = !!a && a.active_admins < MIN_ADMINS;
  const access = a && (tooFewAdmins || a.ending.length) ? { activeAdmins: a.active_admins, tooFewAdmins, ending: a.ending.map((e) => ({ handle: e.handle, role: e.role, daysLeft: e.days_left })) } : null;
  const t = rows.tasks, tasks = t && (t.overdue.length || t.orphaned.length) ? { overdue: t.overdue.map(({ title, owner, days }) => ({ title, owner, days })), orphaned: t.orphaned.map(({ title, owner }) => ({ title, owner })) } : null;
  const grouped = groupProblems(rows.assets ?? []), assets = grouped.length ? grouped.map((g) => ({ name: g.name, what: g.problems.map(problemText).join("; ") })) : null;
  const policies = rows.policies?.length ? rows.policies.map(({ title, days }) => ({ title, days })) : null;
  if (!rows.signups.length && !rows.messages.length && !rows.feedback.length && !access && !tasks && !assets && !policies) return null;
  const signups = [...rows.signups].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const messages = KINDS.map((k) => ({ label: k.label, count: rows.messages.filter((m) => m.kind === k.id).length })).filter((m) => m.count);
  const byEvent = new Map<string, number[]>();
  for (const f of rows.feedback) byEvent.set(f.event, [...(byEvent.get(f.event) ?? []), f.rating]);
  const feedback = [...byEvent].map(([event, r]) => ({ event: CLUB.events.find((e) => e.date === event)?.title ?? event, average: Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10, count: r.length }))
    .sort((a, b) => b.count - a.count);
  return { from: istDay(new Date(now.getTime() - 7 * 864e5)), to: istDay(now), signups: { count: signups.length, first: signups.slice(0, FIRST_HANDLES).map((s) => s.handle) }, messages, feedback, access, tasks, assets, policies };
}

/** Who gets it: ORGANISER_EMAILS when set (comma- or space-separated), otherwise every admin's email from the database. */
export function digestRecipients(env: string | undefined, admins: { email: string | null }[]): string[] {
  const list = env?.trim() ? env.split(/[\s,;]+/) : admins.map((a) => a.email ?? "");
  return [...new Set(list.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
}

const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
/** "3 sign-ups, 2 messages, 4 ratings": the subject line. */
export const digestHeadline = (d: Digest) => [
  d.signups.count && n(d.signups.count, "sign-up"),
  d.messages.length && n(d.messages.reduce((a, m) => a + m.count, 0), "message"),
  d.feedback.length && n(d.feedback.reduce((a, f) => a + f.count, 0), "rating"),
  d.access && (d.access.tooFewAdmins ? "too few admins" : n(d.access.ending.length, "access ending", "accesses ending")),
  d.tasks?.overdue.length && n(d.tasks.overdue.length, "overdue task"),
  d.tasks?.orphaned.length && n(d.tasks.orphaned.length, "task to reassign", "tasks to reassign"),
  d.assets && n(d.assets.length, "asset to check", "assets to check"),
  d.policies && n(d.policies.length, "policy review due", "policy reviews due"),
].filter(Boolean).join(", ");
