import { createClient } from "@supabase/supabase-js";
import { cleanHandle, validateJoin, type JoinInput, type JoinResult } from "@/lib/join";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { unsubscribeApiUrl, unsubscribeUrl } from "@/lib/email/token";
import { EVENTS, eventDate, eventSlug } from "@/lib/events";
import { SITE_URL } from "@/lib/site";

/* POST /api/join — stores a club sign-up in Supabase (table join_requests).
   Without Supabase configured it answers { fallback: true } so the form can use joinUrl/email instead. */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// small per-instance rate limit: 5 sign-ups per IP per 10 minutes
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  recent.push(now); hits.set(ip, recent);
  return recent.length > 5;
}

const reply = (body: JoinResult, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let input: JoinInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }

  const problem = validateJoin(input);
  if (problem === "spam") return reply({ ok: true, status: "created" }); // don't tell bots they were caught
  if (problem) return reply({ ok: false, error: problem }, 422);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) return reply({ ok: false, error: "Too many sign-ups from here — try again in a few minutes." }, 429);

  if (!URL || !KEY) return reply({ ok: false, error: "Sign-ups are not connected yet.", fallback: true }, 503);

  const db = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await db.from("join_requests").insert({ handle: cleanHandle(input.handle), email: input.email.trim().toLowerCase(), first_event: input.firstEvent });
  if (error?.code === "23505") return reply({ ok: true, status: "exists" }); // that email already signed up
  if (error) return reply({ ok: false, error: "Couldn't save that — please try again.", fallback: true }, 502);
  // a welcome email, if email is set up. A failure here never fails the sign-up itself.
  const email = input.email.trim().toLowerCase(), today = new Date().toISOString().slice(0, 10);
  const first = EVENTS.find((e) => e.date === input.firstEvent), next = EVENTS.find((e) => e.date >= today);
  const mail = welcomeEmail({ handle: cleanHandle(input.handle), firstEventTitle: first?.title, nextEvent: next && { title: next.title, date: eventDate(next), url: next.luma ?? `${SITE_URL}/events/${eventSlug(next)}` }, site: SITE_URL, unsubscribe: unsubscribeUrl(SITE_URL, email) });
  const sent = await sendEmail(email, mail, { unsubscribe: unsubscribeApiUrl(SITE_URL, email) });
  if (!sent.sent && sent.reason === "failed") console.error("welcome email failed:", sent.error);
  return reply({ ok: true, status: "created" }, 201);
}
