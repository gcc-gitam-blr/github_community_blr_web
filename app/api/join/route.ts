import { validateJoin, type JoinInput, type JoinResult } from "@/lib/join";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { finishUrl, tokenFor, unsubscribeApiUrl, unsubscribeUrl } from "@/lib/email/token";
import { EVENTS, eventDate, eventSlug } from "@/lib/events";
import { rateLimited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";
import { serverDb } from "@/lib/supabase-server";

/* POST /api/join — joining the club: a name and an email (through join_club; the table takes no direct inserts).
   Answers with a signed key for the optional second step (GitHub username, first event: /api/join/more), and sends a
   welcome email carrying the same link. Without Supabase it answers { fallback: true } so the form can use the club's
   WhatsApp link or email instead. */
const reply = (body: JoinResult, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let input: JoinInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }

  const problem = validateJoin(input);
  if (problem === "spam") return reply({ ok: true, status: "created" }); // don't tell bots they were caught
  if (problem) return reply({ ok: false, error: problem }, 422);

  if (await rateLimited(req, "join", 5)) return reply({ ok: false, error: "Too many sign-ups from here. Try again in a few minutes." }, 429);

  const db = serverDb();
  if (!db) return reply({ ok: false, error: "Sign-ups are not connected yet.", fallback: true }, 503);

  const email = input.email.trim().toLowerCase(), name = input.name.trim();
  const { data, error } = await db.rpc("join_club", { p_name: name, p_email: email });
  if (error) return reply({ ok: false, error: "Couldn't save that. Please try again.", fallback: true }, 502);
  if (data === "busy") return reply({ ok: false, error: "Lots of sign-ups right now. Please try again in a little while.", fallback: true }, 429);
  const token = tokenFor(email);
  if (data === "exists") return reply({ ok: true, status: "exists", token }); // already joined: still welcome, and they can add the extras
  // a welcome email, if email is set up. A failure here never fails the sign-up itself.
  const today = new Date().toISOString().slice(0, 10), next = EVENTS.find((e) => e.date >= today);
  const mail = welcomeEmail({ name, nextEvent: next && { title: next.title, date: eventDate(next), url: next.luma ?? `${SITE_URL}/events/${eventSlug(next)}` }, finish: finishUrl(SITE_URL, email), site: SITE_URL, unsubscribe: unsubscribeUrl(SITE_URL, email) });
  const sent = await sendEmail(email, mail, { unsubscribe: unsubscribeApiUrl(SITE_URL, email) });
  if (!sent.sent && sent.reason === "failed") console.error("welcome email failed:", sent.error);
  return reply({ ok: true, status: "created", token }, 201);
}
