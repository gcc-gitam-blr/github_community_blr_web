import type { AuthAdmin } from "./github-login";

/* "Email me a code": Epoch sign-in without a GitHub account. The server finds or creates the Supabase account for the
   address, asks Supabase for a one-time code (the same one-time sign-in GitHub sign-in uses), and the club's own mailer
   sends it, so it doesn't depend on Supabase's built-in email (a few messages an hour). The browser then checks the code
   with Supabase (verifyOtp), which also limits how long it works and how often it can be guessed.

   Organisers keep signing in with GitHub: an address with organiser access gets an email saying so instead of a code,
   so the admin can't be opened with an email code, and the page never says which addresses are organisers. */

export const CODE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CodeResult =
  | { ok: true; kind: "code"; code: string; userId: string }
  | { ok: true; kind: "organiser"; userId: string }
  | { ok: false; error: string };

/** Finds or creates the account for `email` and returns a fresh sign-in code, or "organiser" for an address with access.
    `isOrganiser` answers null when it couldn't check: then no code is made (an organiser must never get one by accident). */
export async function emailSignInCode(admin: AuthAdmin, email: string, isOrganiser: (userId: string) => Promise<boolean | null>): Promise<CodeResult> {
  const address = email.trim().toLowerCase();
  if (!CODE_EMAIL_RE.test(address) || address.length > 200) return { ok: false, error: "That email doesn't look right." };
  // no user_name: nothing marks this as a GitHub account, so register_profile gives it a handle GitHub can't have
  const created = await admin.createUser({ email: address, email_confirm: true, user_metadata: {} });
  const exists = created.error && (created.error.code === "email_exists" || /already (been )?registered|already exists/i.test(created.error.message));
  if (created.error && !exists) return { ok: false, error: "Couldn't create your account. Please try again." };
  const link = await admin.generateLink({ type: "magiclink", email: address });
  const code = link.data?.properties?.email_otp;
  if (link.error || !link.data?.user || !code) return { ok: false, error: "Couldn't make a sign-in code. Please try again." };
  const organiser = await isOrganiser(link.data.user.id);
  if (organiser === null) return { ok: false, error: "Couldn't check that address just now. Please try again." };
  if (organiser) return { ok: true, kind: "organiser", userId: link.data.user.id };
  return { ok: true, kind: "code", code, userId: link.data.user.id };
}
