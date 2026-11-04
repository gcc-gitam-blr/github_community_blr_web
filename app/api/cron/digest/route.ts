import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildDigest, digestRecipients } from "@/lib/digest";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { digestEmail } from "@/lib/email/templates";
import { SITE_URL } from "@/lib/site";

/* GET /api/cron/digest — Vercel cron calls this every Monday morning (vercel.json) and emails organisers the past week.
   Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused, and without CRON_SECRET nothing runs.
   It reads with SUPABASE_SERVICE_ROLE_KEY (server only), because the tables are staff-only and no one is signed in. */
export const dynamic = "force-dynamic";
const json = (b: object, status = 200) => Response.json(b, { status });

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET, got = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(`Bearer ${secret}`), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return json({ ok: false, error: "CRON_SECRET isn't set, so the digest is off." }, 503);
  if (!authorised(req)) return json({ ok: false, error: "Not allowed." }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ ok: true, sent: 0, skipped: "The database isn't connected (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)." });
  if (!emailConfigured()) return json({ ok: true, sent: 0, skipped: "Email isn't set up yet (see README)." });

  const db = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date(), since = new Date(now.getTime() - 7 * 864e5).toISOString();
  const [s, m, f] = await Promise.all([
    db.from("join_requests").select("*").gte("created_at", since).limit(1000), // "*": works before and after the schema has `source`
    db.from("messages").select("kind").gte("created_at", since).limit(1000),
    db.from("event_feedback").select("event, rating").gte("created_at", since).limit(2000),
  ]);
  if (s.error || m.error || f.error) return json({ ok: false, error: "Couldn't read the past week." }, 502);
  // access that is about to end, and whether two admins remain; also lets the display copies of roles catch up with expired appointments
  const w = await db.rpc("appointment_warnings");
  if (w.error) console.error("digest: appointment_warnings failed (is supabase/schema.sql up to date?):", w.error.message);
  else await db.rpc("sync_profile_roles");
  const tw = await db.rpc("task_warnings");
  if (tw.error) console.error("digest: task_warnings failed (is supabase/schema.sql up to date?):", tw.error.message);
  const aw = await db.rpc("asset_problems_for_digest");
  if (aw.error) console.error("digest: asset_problems_for_digest failed (is supabase/schema.sql up to date?):", aw.error.message);
  const pw = await db.rpc("policy_reviews_due");
  if (pw.error) console.error("digest: policy_reviews_due failed (is supabase/schema.sql up to date?):", pw.error.message);
  // people put on the list by an event's check-in didn't sign up this week; only the ones who joined themselves count
  const signups = (s.data ?? []).filter((r) => r.source !== "attended").map((r) => ({ name: r.name, handle: r.handle, created_at: r.created_at }));
  const digest = buildDigest({ signups, messages: m.data ?? [], feedback: f.data ?? [], access: w.error ? undefined : w.data, tasks: tw.error ? undefined : tw.data, assets: aw.error ? undefined : aw.data, policies: pw.error ? undefined : pw.data }, now);
  if (!digest) return json({ ok: true, sent: 0, skipped: "Nothing happened this week." });

  // the admins and the core team: whoever holds an active admin or core appointment today, not the profile's role copy.
  // Before supabase/schema.sql is re-run, team_emails doesn't exist yet, so it falls back to the admins alone.
  let team = await db.rpc("team_emails");
  if (team.error) { console.error("digest: team_emails failed (is supabase/schema.sql up to date?):", team.error.message); team = await db.rpc("admin_emails"); }
  const to = digestRecipients(process.env.ORGANISER_EMAILS, (team.data ?? []) as { email: string | null }[]);
  if (!to.length) return json({ ok: true, sent: 0, skipped: "No organiser email to send to (make someone admin or core, or set ORGANISER_EMAILS)." });
  const mail = digestEmail(digest, SITE_URL);
  const results = await Promise.all(to.map((t) => sendEmail(t, mail)));
  const sent = results.filter((r) => r.sent).length;
  if (sent < to.length) console.error("digest: some emails failed", results.filter((r) => !r.sent));
  return json({ ok: sent > 0, sent, failed: to.length - sent }, sent > 0 ? 200 : 502);
}
