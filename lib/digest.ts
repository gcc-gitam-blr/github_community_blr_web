import { CLUB } from "./config";
import { KINDS } from "./contact";
import { EMAIL_RE } from "./join";

/* The Monday email to organisers: what happened on the site in the past 7 days.
   Built from plain rows so it can be tested without a database; app/api/cron/digest fetches the rows and sends it. */
export interface DigestRows {
  signups: { handle: string; created_at: string }[];
  messages: { kind: string }[];
  feedback: { event: string; rating: number }[];
}
export interface Digest {
  from: string; to: string; // the week, as YYYY-MM-DD in India
  signups: { count: number; first: string[] }; // the first few handles, oldest first
  messages: { label: string; count: number }[];
  feedback: { event: string; average: number; count: number }[];
}

export const FIRST_HANDLES = 5;
const istDay = (t: Date) => new Date(t.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** The summary, or null when nothing happened (then no email goes out). */
export function buildDigest(rows: DigestRows, now = new Date()): Digest | null {
  if (!rows.signups.length && !rows.messages.length && !rows.feedback.length) return null;
  const signups = [...rows.signups].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const messages = KINDS.map((k) => ({ label: k.label, count: rows.messages.filter((m) => m.kind === k.id).length })).filter((m) => m.count);
  const byEvent = new Map<string, number[]>();
  for (const f of rows.feedback) byEvent.set(f.event, [...(byEvent.get(f.event) ?? []), f.rating]);
  const feedback = [...byEvent].map(([event, r]) => ({ event: CLUB.events.find((e) => e.date === event)?.title ?? event, average: Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10, count: r.length }))
    .sort((a, b) => b.count - a.count);
  return { from: istDay(new Date(now.getTime() - 7 * 864e5)), to: istDay(now), signups: { count: signups.length, first: signups.slice(0, FIRST_HANDLES).map((s) => s.handle) }, messages, feedback };
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
].filter(Boolean).join(", ");
