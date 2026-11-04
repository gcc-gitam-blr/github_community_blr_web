import { createClient } from "@supabase/supabase-js";
import { certificateExtras, certificateUrl, eventByDate } from "@/lib/certificates";
import { sendPaced } from "@/lib/email/paced";
import { batchMailer, emailConfigured } from "@/lib/email/send";
import { certificateEmail, noteProblem } from "@/lib/email/templates";
import { SITE_URL } from "@/lib/site";

/* POST /api/certificates — an admin emails certificates to the people marked as attended at one event.
   { event: "2026-10-07" }               → everyone at that event who hasn't been sent one yet
   { event, ids: ["…"] }                 → just these people (also to re-send)
   Like /api/broadcast, the caller proves who they are with their login and the database rules decide the rest. */
export const maxDuration = 60;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAX_PER_SEND = 450; // stays under a Gmail account's ~500/day limit
const json = (b: object, status = 200) => Response.json(b, { status });

export async function POST(req: Request) {
  if (!URL || !KEY) return json({ ok: false, error: "The database isn't connected yet." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Sign in first." }, 401);
  let body: { event?: string; ids?: string[]; note?: string; subject?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  const event = eventByDate(body.event ?? "");
  if (!event) return json({ ok: false, error: "Pick an event." }, 422);
  if (body.ids && (!Array.isArray(body.ids) || body.ids.some((x) => typeof x !== "string"))) return json({ ok: false, error: "Bad request." }, 400);
  // the team's own message and subject for this send (Admin → Attendance → The email)
  if ((body.note !== undefined && typeof body.note !== "string") || (body.subject !== undefined && typeof body.subject !== "string")) return json({ ok: false, error: "Bad request." }, 400);
  const note = (body.note ?? "").trim(), subject = (body.subject ?? "").trim();
  const bad = noteProblem(note, subject);
  if (bad) return json({ ok: false, error: bad }, 422);
  if (!emailConfigured()) return json({ ok: false, error: "Email isn't set up yet: add the email settings in Vercel (see the README)." }, 503);

  const db = createClient(URL, KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: user } = await db.auth.getUser(token);
  const { data: role } = await db.rpc("my_role");
  if (!user.user || role !== "admin") return json({ ok: false, error: "Only organiser admins can send certificates." }, 403);

  let q = db.from("attendance").select("id, name, email, created_at").eq("event", event.date);
  q = body.ids?.length ? q.in("id", body.ids) : q.is("emailed_at", null);
  const { data: rows, error } = await q.limit(MAX_PER_SEND + 1);
  if (error) return json({ ok: false, error: "Couldn't load the attendance list." }, 502);
  if (!rows?.length) return json({ ok: false, error: body.ids?.length ? "Nobody selected." : "Everyone here already has their certificate." }, 422);
  if (rows.length > MAX_PER_SEND) return json({ ok: false, error: `That's more than ${MAX_PER_SEND} people: send in batches.` }, 422);

  // one login for the whole batch, tried before anything is sent: a wrong password stops here, with what to do
  const mailer = await batchMailer();
  try {
    const problem = await mailer.check();
    if (problem) return json({ ok: false, error: `Nothing was sent. ${problem}` }, 502);
    // the same for everyone in this batch: the event's feedback form, and the next event to come
    const { feedback, next: nextUp } = certificateExtras(event, SITE_URL);
    // one at a time, a few seconds apart, each person marked as sent the moment theirs goes (lib/email/paced.ts);
    // what doesn't fit in this call's 45 seconds is left for the next one, which the admin page makes by itself
    const r = await sendPaced(rows,
      (p) => mailer.send(p.email, certificateEmail({ name: p.name, eventTitle: event.title, url: certificateUrl(SITE_URL, p.id), site: SITE_URL, feedback, next: nextUp, note, subject })),
      async (p) => { await db.from("attendance").update({ emailed_at: new Date().toISOString() }).eq("id", p.id); },
      Date.now() + 45_000);
    if (!r.sent && r.problem) return json({ ok: false, error: `Nothing was sent. ${r.problem}` }, 502);
    return json({ ok: true, sent: r.sent, failed: r.problem ? 1 : 0, left: r.left, total: rows.length, ...(r.problem ? { problem: r.problem } : {}) });
  } finally { mailer.close(); }
}
