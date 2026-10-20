import { createClient } from "@supabase/supabase-js";
import { certificateExtras, certificateUrl, eventByDate, linkedinUrl } from "@/lib/certificates";
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
    const sentIds: string[] = []; let failed = 0, why: string | undefined;
    // stop starting new emails in time to record who got one before the function's 60 s are up; the rest go next time
    // the same for everyone in this batch: the event's feedback form, and the next event to come
    const { feedback, next: nextUp } = certificateExtras(event, SITE_URL);
    const queue = [...rows], now = new Date().toISOString(), stopAt = Date.now() + 45_000;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (queue.length && Date.now() < stopAt) {
        const r = queue.shift()!;
        const url = certificateUrl(SITE_URL, r.id);
        const mail = certificateEmail({ name: r.name, eventTitle: event.title, url, linkedin: linkedinUrl({ event: event.date, id: r.id, issued: now, site: SITE_URL }), site: SITE_URL, feedback, next: nextUp, note, subject });
        const res = await mailer.send(r.email, mail);
        if (res.sent) sentIds.push(r.id);
        else { failed++; why ??= res.why; console.error("certificate email failed:", res.error); }
      }
    }));
    if (sentIds.length) await db.from("attendance").update({ emailed_at: now }).in("id", sentIds);
    if (!sentIds.length && failed) return json({ ok: false, error: `Nothing was sent. ${why ?? ""}`.trim() }, 502);
    return json({ ok: true, sent: sentIds.length, failed, left: queue.length, total: rows.length, ...(why ? { problem: why } : {}) });
  } finally { mailer.close(); }
}
