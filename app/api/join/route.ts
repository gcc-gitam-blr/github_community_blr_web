import { cleanHandle, validateJoin, type JoinInput, type JoinResult } from "@/lib/join";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { unsubscribeApiUrl, unsubscribeUrl } from "@/lib/email/token";
import { EVENTS, eventDate, eventSlug } from "@/lib/events";
import { rateLimited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";
import { serverDb } from "@/lib/supabase-server";

/* POST /api/join — stores a club sign-up in Supabase (through submit_join; the table itself takes no direct inserts).
   Without Supabase configured it answers { fallback: true } so the form can use joinUrl/email instead. */

const reply = (body: JoinResult, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let input: JoinInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }

  const problem = validateJoin(input);
  if (problem === "spam") return reply({ ok: true, status: "created" }); // don't tell bots they were caught
  if (problem) return reply({ ok: false, error: problem }, 422);

  if (await rateLimited(req, "join", 5)) return reply({ ok: false, error: "Too many sign-ups from here — try again in a few minutes." }, 429);

  const db = serverDb();
  if (!db) return reply({ ok: false, error: "Sign-ups are not connected yet.", fallback: true }, 503);

  const { data, error } = await db.rpc("submit_join", { p_handle: cleanHandle(input.handle), p_email: input.email.trim().toLowerCase(), p_first_event: input.firstEvent });
  if (error) return reply({ ok: false, error: "Couldn't save that — please try again.", fallback: true }, 502);
  if (data === "busy") return reply({ ok: false, error: "Lots of sign-ups right now — please try again in a little while.", fallback: true }, 429);
  if (data === "exists") return reply({ ok: true, status: "exists" }); // that email already signed up
  // a welcome email, if email is set up. A failure here never fails the sign-up itself.
  const email = input.email.trim().toLowerCase(), today = new Date().toISOString().slice(0, 10);
  const first = EVENTS.find((e) => e.date === input.firstEvent), next = EVENTS.find((e) => e.date >= today);
  const mail = welcomeEmail({ handle: cleanHandle(input.handle), firstEventTitle: first?.title, nextEvent: next && { title: next.title, date: eventDate(next), url: next.luma ?? `${SITE_URL}/events/${eventSlug(next)}` }, site: SITE_URL, unsubscribe: unsubscribeUrl(SITE_URL, email) });
  const sent = await sendEmail(email, mail, { unsubscribe: unsubscribeApiUrl(SITE_URL, email) });
  if (!sent.sent && sent.reason === "failed") console.error("welcome email failed:", sent.error);
  return reply({ ok: true, status: "created" }, 201);
}
