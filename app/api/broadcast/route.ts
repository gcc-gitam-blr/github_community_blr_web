import { createClient } from "@supabase/supabase-js";
import { sendEmail, emailConfigured } from "@/lib/email/send";
import { broadcastEmail } from "@/lib/email/templates";
import { unsubscribeApiUrl, unsubscribeUrl } from "@/lib/email/token";
import { SITE_URL } from "@/lib/site";

/* POST /api/broadcast — an admin emails every club sign-up who hasn't unsubscribed.
   The caller proves who they are with their Supabase login (Bearer token); the database's own
   rules (RLS) decide what they may read, and only role 'admin' may send. */
export const maxDuration = 60;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAX_PER_SEND = 450; // stays under a Gmail account's ~500/day limit

const json = (b: object, status = 200) => Response.json(b, { status });

export async function POST(req: Request) {
  if (!URL || !KEY) return json({ ok: false, error: "The database isn't connected yet." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Sign in first." }, 401);

  let body: { subject?: string; message?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  const subject = (body.subject ?? "").trim(), message = (body.message ?? "").trim();
  if (subject.length < 3 || subject.length > 120) return json({ ok: false, error: "Subject must be 3–120 characters." }, 422);
  if (message.length < 10 || message.length > 5000) return json({ ok: false, error: "Message must be 10–5000 characters." }, 422);
  if (!emailConfigured()) return json({ ok: false, error: "Email isn't set up yet — add the email settings in Vercel (see README)." }, 503);

  const db = createClient(URL, KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: user } = await db.auth.getUser(token);
  const { data: role } = await db.rpc("my_role");
  if (!user.user || role !== "admin") return json({ ok: false, error: "Only organiser admins can send emails." }, 403);

  const { data: rows, error } = await db.from("join_requests").select("email").eq("unsubscribed", false).limit(MAX_PER_SEND + 1);
  if (error) return json({ ok: false, error: "Couldn't load the list." }, 502);
  if (!rows?.length) return json({ ok: false, error: "Nobody to email yet." }, 422);
  if (rows.length > MAX_PER_SEND) return json({ ok: false, error: `That's more than ${MAX_PER_SEND} people — send in batches or ask a developer to raise the limit.` }, 422);

  let sent = 0, failed = 0;
  const queue = [...rows];
  await Promise.all(Array.from({ length: 5 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const mail = broadcastEmail({ subject, message, site: SITE_URL, unsubscribe: unsubscribeUrl(SITE_URL, r.email) });
      const res = await sendEmail(r.email, mail, { unsubscribe: unsubscribeApiUrl(SITE_URL, r.email) });
      if (res.sent) sent++; else failed++;
    }
  }));
  await db.from("broadcasts").insert({ sent_by: user.user.id, subject, recipients: sent });
  return json({ ok: true, sent, failed, total: rows.length });
}
