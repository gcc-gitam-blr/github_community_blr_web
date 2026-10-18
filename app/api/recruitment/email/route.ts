import { createClient } from "@supabase/supabase-js";
import { batchMailer, emailConfigured } from "@/lib/email/send";
import { applicantEmail } from "@/lib/email/templates";
import { SITE_URL } from "@/lib/site";

/* POST /api/recruitment/email — an admin emails one group of a round's applicants (Admin → Recruitment → Email applicants):
   { campaign: 3, group: "interview" | "selected" | "waitlisted" | "rejected" | "all", subject, message }
   Each person gets their own email with their first name. As with the other sends, the caller proves who they are with
   their login, the database's rules decide what they can read, and only admins send. */
export const maxDuration = 60;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GROUPS = ["interview", "selected", "waitlisted", "rejected", "all"] as const;
const json = (b: object, status = 200) => Response.json(b, { status });

export async function POST(req: Request) {
  if (!URL || !KEY) return json({ ok: false, error: "The database isn't connected yet." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Sign in first." }, 401);
  let body: { campaign?: number; group?: string; subject?: string; message?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  const subject = (body.subject ?? "").trim(), message = (body.message ?? "").trim(), group = body.group as (typeof GROUPS)[number];
  if (!Number.isInteger(body.campaign) || !GROUPS.includes(group)) return json({ ok: false, error: "Pick a round and who it goes to." }, 422);
  if (subject.length < 3 || subject.length > 120) return json({ ok: false, error: "The subject needs 3 to 120 characters." }, 422);
  if (message.length < 10 || message.length > 5000) return json({ ok: false, error: "The message needs 10 to 5000 characters." }, 422);
  if (!emailConfigured()) return json({ ok: false, error: "Email isn't set up yet: add the email settings in Vercel (see the README)." }, 503);

  const db = createClient(URL, KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: user } = await db.auth.getUser(token);
  const { data: role } = await db.rpc("my_role");
  if (!user.user || role !== "admin") return json({ ok: false, error: "Only admins email applicants." }, 403);

  const { data: round } = await db.from("recruitment_campaigns").select("id, name").eq("id", body.campaign!).maybeSingle();
  if (!round) return json({ ok: false, error: "That round doesn't exist." }, 404);
  let q = db.from("applications").select("name, email").eq("campaign_id", round.id);
  q = group === "all" ? q.neq("status", "withdrawn") : q.eq("status", group);
  const { data: people, error } = await q.limit(1000);
  if (error) return json({ ok: false, error: "Couldn't load the applicants." }, 502);
  if (!people?.length) return json({ ok: false, error: "Nobody is in that group." }, 422);

  // one login for the whole batch, tried before anything is sent: a wrong password stops here, with what to do
  const mailer = await batchMailer();
  try {
    const problem = await mailer.check();
    if (problem) return json({ ok: false, error: `Nothing was sent. ${problem}` }, 502);
    let sent = 0, failed = 0, why: string | undefined;
    const queue = [...people], stopAt = Date.now() + 45_000;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (queue.length && Date.now() < stopAt) {
        const p = queue.shift()!;
        const res = await mailer.send(p.email, applicantEmail({ name: p.name, round: round.name, subject, message, site: SITE_URL }));
        if (res.sent) sent++; else { failed++; why ??= res.why; console.error("applicant email failed:", res.error); }
      }
    }));
    if (sent) await db.rpc("log_recruitment_email", { p_campaign: round.id, p_status: group, p_count: sent });
    if (!sent && failed) return json({ ok: false, error: `Nothing was sent. ${why ?? ""}`.trim() }, 502);
    return json({ ok: true, sent, failed, total: people.length, ...(queue.length ? { left: queue.length } : {}), ...(why ? { problem: why } : {}) });
  } finally { mailer.close(); }
}
