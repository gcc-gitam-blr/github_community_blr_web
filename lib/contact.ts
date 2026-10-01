import { EMAIL_RE, HANDLE_RE, MIN_FILL_MS, cleanHandle } from "./join";

/* "Get involved" messages: shared by the form (instant feedback) and /api/contact (the real check). */
export const KINDS = [
  { id: "apply", label: "Join the core team", blurb: "Help run the club: events, tech, design, content, outreach.", ask: "Which role interests you, and why? Anything you've built or organised before?" },
  { id: "sponsor", label: "Sponsor or partner", blurb: "Support our events or collaborate with the club.", ask: "Tell us about your organisation and what you have in mind." },
  { id: "speaker", label: "Speak or run a workshop", blurb: "Share your experience with students.", ask: "What would you like to talk about, and who is it for?" },
  { id: "question", label: "Ask us anything", blurb: "Questions about the club, events or Epoch.", ask: "What would you like to know?" },
] as const;
export type Kind = (typeof KINDS)[number]["id"];

export interface ContactInput { kind: string; name: string; email: string; handle?: string; message: string; website?: string; startedAt?: number }
export type ContactResult = { ok: true } | { ok: false; error: string };

export function validateContact(i: ContactInput, now = Date.now()): string | null {
  if (i.website) return "spam"; // honeypot
  if (i.startedAt && now - i.startedAt < MIN_FILL_MS) return "spam";
  if (!KINDS.some((k) => k.id === i.kind)) return "Pick what this is about.";
  const name = (i.name ?? "").trim();
  if (name.length < 2 || name.length > 80) return "Please enter your name.";
  if (!EMAIL_RE.test((i.email ?? "").trim())) return "That email doesn't look right.";
  const h = cleanHandle(i.handle ?? "");
  if (h && !HANDLE_RE.test(h)) return "That doesn't look like a GitHub username.";
  if (i.kind === "apply" && !h) return "Add your GitHub username — we look at it when choosing the team.";
  const m = (i.message ?? "").trim();
  if (m.length < 10) return "Tell us a little more (at least a sentence).";
  if (m.length > 3000) return "That's a bit long — please keep it under 3000 characters.";
  return null;
}
