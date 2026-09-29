import { CLUB } from "./config";

/* Club sign-up rules, shared by the form (instant feedback) and the /api/join endpoint (the real check). */
export interface JoinInput { handle: string; email: string; firstEvent: string; website?: string; startedAt?: number }
export type JoinResult = { ok: true; status: "created" | "exists" } | { ok: false; error: string; fallback?: boolean };

export const HANDLE_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i; // GitHub's own username rule
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export const MIN_FILL_MS = 2500; // humans take longer than this to fill three fields

export const cleanHandle = (h: string) => h.trim().replace(/^@/, "");

export function validateJoin(i: JoinInput, now = Date.now()): string | null {
  if (i.website) return "spam"; // honeypot: a hidden field only bots fill in
  if (i.startedAt && now - i.startedAt < MIN_FILL_MS) return "spam";
  if (!HANDLE_RE.test(cleanHandle(i.handle ?? ""))) return "That doesn't look like a GitHub username.";
  if (!EMAIL_RE.test((i.email ?? "").trim())) return "That email doesn't look right.";
  if (!CLUB.events.some((e) => e.date === i.firstEvent)) return "Pick what you want to try first.";
  return null;
}
