import { CLUB } from "./config";

/* Joining the club, shared by the forms (instant feedback) and /api/join (the real check).
   Two steps, because a long form loses people: first just a name and an email (that's a sign-up), then, optionally, a
   GitHub username and what they want to try first. The second step is saved with a signed key that only the server can
   make, returned by the first step and put in the welcome email, so nobody can change someone else's sign-up. */
export interface JoinInput { name: string; email: string; website?: string }
export interface MoreInput { email: string; token: string; handle?: string; firstEvent?: string }
export type JoinResult = { ok: true; status: "created" | "exists"; token?: string } | { ok: false; error: string; fallback?: boolean };

export const HANDLE_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i; // GitHub's own username rule
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export const MIN_FILL_MS = 2500; // the longer forms (contact, feedback, applications): humans take longer than this

export const cleanHandle = (h: string) => h.trim().replace(/^@/, "");

export function validateJoin(i: JoinInput): string | null {
  // honeypot: a hidden field only bots fill in. No "too fast" check here: the browser fills both fields and people press
  // Join at once, so timing caught real people (who were then told they'd joined when nothing was saved), never bots.
  if (i.website) return "spam";
  const name = (i.name ?? "").trim();
  if (name.length < 2 || name.length > 80) return "What should we call you?";
  if (!EMAIL_RE.test((i.email ?? "").trim())) return "That email doesn't look right.";
  return null;
}

/** The optional second step: a real-looking GitHub username and/or one of this year's events. */
export function validateMore(i: MoreInput): string | null {
  if (!EMAIL_RE.test((i.email ?? "").trim()) || !i.token) return "That link has expired. Join again with the same email to get a fresh one.";
  const h = cleanHandle(i.handle ?? "");
  if (h && !HANDLE_RE.test(h)) return "That doesn't look like a GitHub username.";
  if (i.firstEvent && !CLUB.events.some((e) => e.date === i.firstEvent)) return "Pick one of this year's events.";
  if (!h && !i.firstEvent) return "Add your GitHub username, or pick what you'd like to try first.";
  return null;
}
