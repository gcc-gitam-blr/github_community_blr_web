import { EMAIL_RE, MIN_FILL_MS } from "./join";

/* "Notify me when Epoch dates are announced": shared by the form (instant feedback) and /api/epoch-interest (the real check). */
export interface InterestInput { email: string; website?: string; elapsedMs?: number }
export type InterestResult = { ok: true; status: "created" | "exists" } | { ok: false; error: string; off?: boolean };

export const FAST_MS = MIN_FILL_MS / 2; // one field, so people are quicker than on the other forms

export function validateInterest(i: InterestInput): string | null {
  if (i.website) return "spam"; // honeypot: a hidden field only bots fill in
  if (i.elapsedMs !== undefined && i.elapsedMs < FAST_MS) return "spam";
  if (!EMAIL_RE.test((i.email ?? "").trim())) return "That email doesn't look right.";
  return null;
}
