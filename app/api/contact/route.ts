import { CLUB } from "@/lib/config";
import { KINDS, validateContact, type ContactInput, type ContactResult } from "@/lib/contact";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { contactAck, contactNotification } from "@/lib/email/templates";
import { cleanHandle } from "@/lib/join";
import { rateLimited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";
import { serverDb } from "@/lib/supabase-server";

/* POST /api/contact — a "Get involved" message. Saved in Supabase (through submit_message) and emailed to the
   club inbox with Reply-To set to the sender; the sender gets a short acknowledgement.
   Works with either part missing: no database → email only; no email → saved only. */
const reply = (body: ContactResult, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let input: ContactInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }

  const problem = validateContact(input);
  if (problem === "spam") return reply({ ok: true }); // don't tell bots they were caught
  if (problem) return reply({ ok: false, error: problem }, 422);
  if (await rateLimited(req, "contact")) return reply({ ok: false, error: "Too many messages from here — please try again in a few minutes." }, 429);

  const db = serverDb();
  const inbox = CLUB.email || process.env.SMTP_USER || "";
  const canEmail = emailConfigured() && !!inbox;
  if (!db && !canEmail) return reply({ ok: false, error: "The club inbox isn't switched on yet.", fallback: true }, 503); // the form then hands the message to Instagram

  const name = input.name.trim(), email = input.email.trim().toLowerCase(), handle = cleanHandle(input.handle ?? "") || undefined, message = input.message.trim();
  const kindLabel = KINDS.find((k) => k.id === input.kind)!.label;

  if (db) {
    const { data, error } = await db.rpc("submit_message", { p_kind: input.kind, p_name: name, p_email: email, p_handle: handle ?? null, p_message: message });
    if (error) return reply({ ok: false, error: "Couldn't save that — please try again." }, 502);
    if (data === "busy") return reply({ ok: false, error: "Lots of messages right now — please try again in a little while." }, 429);
  }
  if (canEmail) {
    const note = await sendEmail(inbox, contactNotification({ kindLabel, name, email, handle, message, site: SITE_URL }), { replyTo: email });
    if (!note.sent) console.error("contact notification failed:", note.reason === "failed" ? note.error : note.reason);
    await sendEmail(email, contactAck({ name, kindLabel, site: SITE_URL })); // best effort
  }
  return reply({ ok: true }, 201);
}
