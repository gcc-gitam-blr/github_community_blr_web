import { createClient } from "@supabase/supabase-js";
import { batchMailer, emailConfigured } from "@/lib/email/send";
import { broadcastEmail } from "@/lib/email/templates";
import { unsubscribeApiUrl, unsubscribeUrl } from "@/lib/email/token";
import { SITE_URL } from "@/lib/site";
import { NOTE_MAX, WHY, newsletterEmail } from "@/lib/newsletter";
import { lessonBySlug } from "@/lib/lessons";
import { todayInIndia } from "@/lib/events";

/* POST /api/broadcast — an admin emails everyone on one list who hasn't unsubscribed: club sign-ups ("members",
   the default) or the "tell me when Epoch dates are out" list ("epoch"). One unsubscribe link covers both.
   Either the weekly newsletter ({ lesson, note }: one "Git in 60 seconds" lesson, each copy greeting the person by
   name) or a message the admin writes ({ subject, message }).
   The caller proves who they are with their Supabase login (Bearer token); the database's own
   rules (RLS) decide what they may read, and only role 'admin' may send. */
export const maxDuration = 60;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAX_PER_SEND = 450; // stays under a Gmail account's ~500/day limit
const LISTS = { members: "join_requests", epoch: "epoch_interest" } as const;

const json = (b: object, status = 200) => Response.json(b, { status });

export async function POST(req: Request) {
  if (!URL || !KEY) return json({ ok: false, error: "The database isn't connected yet." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Sign in first." }, 401);

  let body: { subject?: string; message?: string; audience?: string; lesson?: string; note?: string; test?: boolean };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  const lesson = body.lesson ? lessonBySlug(body.lesson) : undefined;
  if (body.lesson && !lesson) return json({ ok: false, error: "That lesson doesn't exist. Reload the page and pick one again." }, 422);
  const note = (body.note ?? "").trim();
  if (note.length > NOTE_MAX) return json({ ok: false, error: `Keep the note under ${NOTE_MAX} characters.` }, 422);
  const subject = lesson ? lesson.subject : (body.subject ?? "").trim(), message = (body.message ?? "").trim();
  if (!lesson) {
    if (subject.length < 3 || subject.length > 120) return json({ ok: false, error: "Subject must be 3–120 characters." }, 422);
    if (message.length < 10 || message.length > 5000) return json({ ok: false, error: "Message must be 10–5000 characters." }, 422);
  }
  const audience = body.audience ?? "members";
  if (!(audience in LISTS)) return json({ ok: false, error: "Pick who it goes to." }, 422);
  if (!emailConfigured()) return json({ ok: false, error: "Email isn't set up yet: add the email settings in Vercel (see the README)." }, 503);

  const db = createClient(URL, KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: user } = await db.auth.getUser(token);
  const { data: role } = await db.rpc("my_role");
  if (!user.user || role !== "admin") return json({ ok: false, error: "Only organiser admins can send emails." }, 403);

  // "Send me a test": one copy to the admin who asked, marked as a test and not recorded as a send
  const test = body.test === true;
  const me = test ? (await db.from("profiles").select("name").eq("id", user.user.id).maybeSingle()).data as { name?: string | null } | null : null;
  // club sign-ups have a name, so each newsletter can say "Hey Ada,"; the Epoch list is emails only
  const { data: rows, error } = test ? { data: user.user.email ? [{ email: user.user.email, name: me?.name ?? null }] : [], error: null }
    : await db.from(LISTS[audience as keyof typeof LISTS]).select(audience === "members" ? "email, name" : "email").eq("unsubscribed", false).limit(MAX_PER_SEND + 1)
      .returns<{ email: string; name?: string | null }[]>();
  if (error) return json({ ok: false, error: "Couldn't load the list." }, 502);
  if (test && !rows?.length) return json({ ok: false, error: "Your account has no email address to send the test to." }, 422);
  if (!rows?.length) return json({ ok: false, error: "Nobody to email yet." }, 422);
  if (rows.length > MAX_PER_SEND) return json({ ok: false, error: `That's more than ${MAX_PER_SEND} people: send in batches or ask a developer to raise the limit.` }, 422);

  // one login for the whole batch, tried before anything is sent: a wrong password stops here, with what to do
  const mailer = await batchMailer();
  try {
    const problem = await mailer.check();
    if (problem) return json({ ok: false, error: `Nothing was sent. ${problem}` }, 502);
    let sent = 0, failed = 0, why: string | undefined;
    const queue = [...rows], today = todayInIndia();
    await Promise.all(Array.from({ length: 3 }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const unsubscribe = unsubscribeUrl(SITE_URL, r.email);
        const mail = lesson
          ? newsletterEmail({ lesson: lesson.slug, note, name: r.name, today, site: SITE_URL, unsubscribe, audience: audience as keyof typeof WHY })
          : broadcastEmail({ subject, message, site: SITE_URL, unsubscribe, why: WHY[audience as keyof typeof WHY] });
        const res = await mailer.send(r.email, test ? { ...mail, subject: `[Test] ${mail.subject}` } : mail, { unsubscribe: unsubscribeApiUrl(SITE_URL, r.email) });
        if (res.sent) sent++;
        else { failed++; why ??= res.why; console.error("broadcast email failed:", res.error); }
      }
    }));
    if (sent && !test) await db.from("broadcasts").insert({ sent_by: user.user.id, subject, recipients: sent });
    if (!sent && failed) return json({ ok: false, error: `Nothing was sent. ${why ?? ""}`.trim() }, 502);
    return json({ ok: true, sent, failed, total: rows.length, ...(why ? { problem: why } : {}) });
  } finally { mailer.close(); }
}
