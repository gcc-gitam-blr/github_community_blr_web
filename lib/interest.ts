import { EMAIL_RE } from "./join";

/* "Notify me when Epoch dates are announced": shared by the form (instant feedback) and /api/epoch-interest (the real check). */
export interface InterestInput { email: string; website?: string }
export type InterestResult = { ok: true; status: "created" | "exists" | "unsubscribed" } | { ok: false; error: string; off?: boolean };

export function validateInterest(i: InterestInput): string | null {
  if (i.website) return "spam"; // honeypot: a hidden field only bots fill in
  // no "filled too fast" check here: one field that the browser often autofills in an instant, so it would catch people
  if (!EMAIL_RE.test((i.email ?? "").trim())) return "That email doesn't look right.";
  return null;
}
