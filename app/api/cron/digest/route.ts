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
    db.from("join_requests").select("handle, created_at").gte("created_at", since).limit(1000),
    db.from("messages").select("kind").gte("created_at", since).limit(1000),
    db.from("event_feedback").select("event, rating").gte("created_at", since).limit(2000),
  ]);
  if (s.error || m.error || f.error) return json({ ok: false, error: "Couldn't read the past week." }, 502);
  const digest = buildDigest({ signups: s.data ?? [], messages: m.data ?? [], feedback: f.data ?? [] }, now);
  if (!digest) return json({ ok: true, sent: 0, skipped: "Nothing happened this week." });

  const admins = process.env.ORGANISER_EMAILS?.trim() ? [] : (await db.from("profiles").select("email").eq("role", "admin")).data ?? [];
  const to = digestRecipients(process.env.ORGANISER_EMAILS, admins);
  if (!to.length) return json({ ok: true, sent: 0, skipped: "No organiser email to send to (set ORGANISER_EMAILS, or make someone admin)." });
  const mail = digestEmail(digest, SITE_URL);
  const results = await Promise.all(to.map((t) => sendEmail(t, mail)));
  const sent = results.filter((r) => r.sent).length;
  if (sent < to.length) console.error("digest: some emails failed", results.filter((r) => !r.sent));
  return json({ ok: sent > 0, sent, failed: to.length - sent }, sent > 0 ? 200 : 502);
}
