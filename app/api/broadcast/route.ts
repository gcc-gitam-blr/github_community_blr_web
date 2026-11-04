import { createClient } from "@supabase/supabase-js";
import { batchMailer, emailConfigured } from "@/lib/email/send";
import { sendPaced } from "@/lib/email/paced";
import { broadcastEmail } from "@/lib/email/templates";
import { unsubscribeApiUrl, unsubscribeUrl } from "@/lib/email/token";
import { SITE_URL } from "@/lib/site";
import { NOTE_MAX, WHY, newsletterEmail, type Audience } from "@/lib/newsletter";
import { lessonBySlug } from "@/lib/lessons";
import { todayInIndia } from "@/lib/events";

/* POST /api/broadcast — an admin emails everyone on one list who hasn't unsubscribed: club sign-ups ("members",
   the default) or the "tell me when Epoch dates are out" list ("epoch"). One unsubscribe link covers both.
   Either the weekly newsletter ({ lesson, note }: one "Git in 60 seconds" lesson, each copy greeting the person by
   name) or a message the admin writes ({ subject, message }).

   So it doesn't land in spam, it goes out one email at a time, a few seconds apart (lib/email/paced.ts), which takes
   longer than one call may run. So:
     { lesson | subject+message, audience }  → saves the send, then sends what fits in about 45 seconds
     { id }                                  → carries on with a saved send (the admin page calls this until left is 0)
     { ..., test: true }                     → one copy to the admin who asked, marked [Test], not saved
   Each address is recorded the moment its email goes, so a paused send carries on later and nobody gets two.
   The caller proves who they are with their Supabase login (Bearer token); the database's own
   rules (RLS) decide what they may read, and only role 'admin' may send. */
export const maxDuration = 60;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAX_PER_SEND = 450; // stays under a Gmail account's ~500/day limit
const LISTS = { members: "join_requests", epoch: "epoch_interest" } as const;
const SCHEMA = "Couldn't save the send. Re-run supabase/schema.sql in Supabase (it adds what sending one at a time needs), then try again.";

interface Send { id: number; subject: string; audience: Audience; lesson: string | null; note: string | null; message: string | null; finished_at: string | null }
type Person = { email: string; name?: string | null };

const json = (b: object, status = 200) => Response.json(b, { status });

export async function POST(req: Request) {
  if (!URL || !KEY) return json({ ok: false, error: "The database isn't connected yet." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Sign in first." }, 401);

  let body: { id?: number; subject?: string; message?: string; audience?: string; lesson?: string; note?: string; test?: boolean };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  const resuming = body.id !== undefined;
  if (resuming && !(Number.isInteger(body.id) && body.id! > 0)) return json({ ok: false, error: "Bad request." }, 400);
  const lesson = body.lesson ? lessonBySlug(body.lesson) : undefined;
  if (body.lesson && !lesson) return json({ ok: false, error: "That lesson doesn't exist. Reload the page and pick one again." }, 422);
  const note = (body.note ?? "").trim();
  if (note.length > NOTE_MAX) return json({ ok: false, error: `Keep the note under ${NOTE_MAX} characters.` }, 422);
  const subject = lesson ? lesson.subject : (body.subject ?? "").trim(), message = (body.message ?? "").trim();
  if (!resuming && !lesson) {
    if (subject.length < 3 || subject.length > 120) return json({ ok: false, error: "Subject must be 3–120 characters." }, 422);
    if (message.length < 10 || message.length > 5000) return json({ ok: false, error: "Message must be 10–5000 characters." }, 422);
  }
  const audience = (body.audience ?? "members") as Audience;
  if (!(audience in LISTS)) return json({ ok: false, error: "Pick who it goes to." }, 422);
  if (!emailConfigured()) return json({ ok: false, error: "Email isn't set up yet: add the email settings in Vercel (see the README)." }, 503);

  const db = createClient(URL, KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: user } = await db.auth.getUser(token);
  const { data: role } = await db.rpc("my_role");
  if (!user.user || role !== "admin") return json({ ok: false, error: "Only organiser admins can send emails." }, 403);

  const today = todayInIndia();
  const mailFor = (s: Pick<Send, "audience" | "lesson" | "note" | "subject" | "message">, p: Person) => {
    const unsubscribe = unsubscribeUrl(SITE_URL, p.email);
    return s.lesson
      ? newsletterEmail({ lesson: s.lesson, note: s.note ?? "", name: p.name, today, site: SITE_URL, unsubscribe, audience: s.audience })
      : broadcastEmail({ subject: s.subject, message: s.message ?? "", site: SITE_URL, unsubscribe, why: WHY[s.audience] });
  };
  // mail apps show their own one-click "Unsubscribe" button for these: what Gmail expects of a mailing list
  const headers = (email: string) => ({ unsubscribe: unsubscribeApiUrl(SITE_URL, email) });

  const mailer = await batchMailer();
  try {
    // one login, tried before anything is sent: a wrong password stops here, with what to do
    const problem = await mailer.check();
    if (problem) return json({ ok: false, error: `Nothing was sent. ${problem}` }, 502);

    // "Send me a test": one copy to the admin who asked, marked as a test and not saved as a send
    if (body.test === true) {
      if (!user.user.email) return json({ ok: false, error: "Your account has no email address to send the test to." }, 422);
      const me = (await db.from("profiles").select("name").eq("id", user.user.id).maybeSingle()).data as { name?: string | null } | null;
      const mail = mailFor({ audience, lesson: lesson?.slug ?? null, note, subject, message }, { email: user.user.email, name: me?.name ?? null });
      const res = await mailer.send(user.user.email, { ...mail, subject: `[Test] ${mail.subject}` }, headers(user.user.email));
      return res.sent ? json({ ok: true, sent: 1, left: 0, total: 1 }) : json({ ok: false, error: `Nothing was sent. ${res.reason === "failed" ? res.why : ""}`.trim() }, 502);
    }

    const list = async (a: Audience) => db.from(LISTS[a]).select(a === "members" ? "email, name" : "email").eq("unsubscribed", false).limit(MAX_PER_SEND + 1).returns<Person[]>();
    let send: Send;
    if (resuming) {
      const { data, error } = await db.from("broadcasts").select("id, subject, audience, lesson, note, message, finished_at").eq("id", body.id!).maybeSingle();
      if (error) return json({ ok: false, error: SCHEMA }, 502);
      if (!data) return json({ ok: false, error: "That send wasn't found." }, 404);
      send = data as Send;
      if (send.finished_at) return json({ ok: true, id: send.id, sent: 0, left: 0, total: 0 });
    } else {
      const { data: people, error } = await list(audience);
      if (error) return json({ ok: false, error: "Couldn't load the list." }, 502);
      if (!people?.length) return json({ ok: false, error: "Nobody to email yet." }, 422);
      if (people.length > MAX_PER_SEND) return json({ ok: false, error: `That's more than ${MAX_PER_SEND} people: send in batches or ask a developer to raise the limit.` }, 422);
      const row = { sent_by: user.user.id, subject, audience, lesson: lesson?.slug ?? null, note: lesson ? note || null : null, message: lesson ? null : message, recipients: 0 };
      const { data, error: saveError } = await db.from("broadcasts").insert(row).select("id").single();
      if (saveError || !data) return json({ ok: false, error: SCHEMA }, 502);
      send = { ...row, id: (data as { id: number }).id, finished_at: null };
    }

    // everyone on the list now, less the people this send has already reached
    const [{ data: people, error }, { data: done }] = await Promise.all([
      list(send.audience ?? "members"),
      db.from("broadcast_deliveries").select("email").eq("broadcast_id", send.id).limit(2000).returns<{ email: string }[]>(),
    ]);
    if (error) return json({ ok: false, error: "Couldn't load the list." }, 502);
    const reached = new Set((done ?? []).map((d) => d.email));
    const todo = (people ?? []).filter((p) => !reached.has(p.email.toLowerCase()));

    const r = await sendPaced(todo,
      (p) => mailer.send(p.email, mailFor(send, p), headers(p.email)),
      async (p) => { await db.from("broadcast_deliveries").insert({ broadcast_id: send.id, email: p.email.toLowerCase() }); },
      Date.now() + 45_000);
    const total = reached.size + todo.length, sentSoFar = reached.size + r.sent;
    await db.from("broadcasts").update({ recipients: sentSoFar, ...(r.left ? {} : { finished_at: new Date().toISOString() }) }).eq("id", send.id);
    if (!r.sent && r.problem && !reached.size) return json({ ok: false, id: send.id, error: `Nothing was sent. ${r.problem}` }, 502);
    return json({ ok: true, id: send.id, sent: r.sent, done: sentSoFar, left: r.left, total, ...(r.problem ? { problem: r.problem } : {}) });
  } finally { mailer.close(); }
}
