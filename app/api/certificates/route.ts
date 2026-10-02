import { createClient } from "@supabase/supabase-js";
import { certificateUrl, eventByDate, linkedinUrl } from "@/lib/certificates";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { certificateEmail } from "@/lib/email/templates";
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
  let body: { event?: string; ids?: string[] };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  const event = eventByDate(body.event ?? "");
  if (!event) return json({ ok: false, error: "Pick an event." }, 422);
  if (body.ids && (!Array.isArray(body.ids) || body.ids.some((x) => typeof x !== "string"))) return json({ ok: false, error: "Bad request." }, 400);
  if (!emailConfigured()) return json({ ok: false, error: "Email isn't set up yet — add the email settings in Vercel (see README)." }, 503);

  const db = createClient(URL, KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: user } = await db.auth.getUser(token);
  const { data: role } = await db.rpc("my_role");
  if (!user.user || role !== "admin") return json({ ok: false, error: "Only organiser admins can send certificates." }, 403);

  let q = db.from("attendance").select("id, name, email, created_at").eq("event", event.date);
  q = body.ids?.length ? q.in("id", body.ids) : q.is("emailed_at", null);
  const { data: rows, error } = await q.limit(MAX_PER_SEND + 1);
  if (error) return json({ ok: false, error: "Couldn't load the attendance list." }, 502);
  if (!rows?.length) return json({ ok: false, error: body.ids?.length ? "Nobody selected." : "Everyone here already has their certificate." }, 422);
  if (rows.length > MAX_PER_SEND) return json({ ok: false, error: `That's more than ${MAX_PER_SEND} people — send in batches.` }, 422);

  const sentIds: string[] = []; let failed = 0;
  const queue = [...rows], now = new Date().toISOString();
  await Promise.all(Array.from({ length: 5 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const url = certificateUrl(SITE_URL, r.id);
      const mail = certificateEmail({ name: r.name, eventTitle: event.title, url, linkedin: linkedinUrl({ event: event.date, id: r.id, issued: now, site: SITE_URL }), site: SITE_URL });
      if ((await sendEmail(r.email, mail)).sent) sentIds.push(r.id); else failed++;
    }
  }));
  if (sentIds.length) await db.from("attendance").update({ emailed_at: now }).in("id", sentIds);
  return json({ ok: true, sent: sentIds.length, failed, total: rows.length });
}
