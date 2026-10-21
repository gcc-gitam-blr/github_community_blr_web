import { createClient } from "@supabase/supabase-js";
import { CODE_EMAIL_RE, emailSignInCode } from "@/lib/auth/email-code";
import type { AuthAdmin } from "@/lib/auth/github-login";
import { sendEmail, emailConfigured } from "@/lib/email/send";
import { organiserSignInEmail, signInCodeEmail } from "@/lib/email/templates";
import { todayInIndia } from "@/lib/events";
import { keyLimited, rateLimited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";

/* POST /api/auth/email { email } — Epoch's "Email me a code" (lib/auth/email-code.ts). Emails a one-time code; the
   browser checks it with Supabase. The answer is the same whether a code or an "organisers use GitHub" note went out,
   so this page can't be used to find out which addresses are organisers. */
const reply = (body: { ok: boolean; error?: string }, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let email = "";
  try { email = String((await req.json())?.email ?? "").trim().toLowerCase(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }
  if (!CODE_EMAIL_RE.test(email) || email.length > 200) return reply({ ok: false, error: "That email doesn't look right." }, 422);

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !emailConfigured()) return reply({ ok: false, error: "Email sign-in isn't switched on here. Sign in with GitHub instead." }, 503);
  // a whole campus can share one address at the desk, so the per-device limit is generous; one inbox gets a few codes at most
  if (await rateLimited(req, "email-code", 40)) return reply({ ok: false, error: "Too many codes asked for from here. Please wait a few minutes." }, 429);
  if (await keyLimited("email-code-to", email, 4, 15 * 60_000)) return reply({ ok: false, error: "We've sent a few codes to that address already. Use the newest one, or wait 15 minutes." }, 429);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const isOrganiser = async (userId: string) => {
    const today = todayInIndia();
    const { data, error } = await db.from("appointments").select("id").eq("user_id", userId).is("revoked_at", null).lte("starts_on", today).gte("ends_on", today).limit(1);
    return error ? null : (data?.length ?? 0) > 0;
  };
  const made = await emailSignInCode(db.auth.admin as unknown as AuthAdmin, email, isOrganiser);
  if (!made.ok) return reply({ ok: false, error: made.error }, 502);

  const mail = made.kind === "code" ? signInCodeEmail({ code: made.code, site: SITE_URL }) : organiserSignInEmail({ site: SITE_URL });
  const sent = await sendEmail(email, mail);
  if (!sent.sent) return reply({ ok: false, error: "Couldn't send the email just now. Please try again, or sign in with GitHub." }, 502);
  return reply({ ok: true });
}
