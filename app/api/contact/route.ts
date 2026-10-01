import { createClient } from "@supabase/supabase-js";
import { CLUB } from "@/lib/config";
import { KINDS, validateContact, type ContactInput, type ContactResult } from "@/lib/contact";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { contactAck, contactNotification } from "@/lib/email/templates";
import { cleanHandle } from "@/lib/join";
import { clientIp, limited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";

/* POST /api/contact — a "Get involved" message. Saved in Supabase (table `messages`) and emailed to the
   club inbox with Reply-To set to the sender; the sender gets a short acknowledgement.
   Works with either part missing: no database → email only; no email → saved only. */
const reply = (body: ContactResult, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let input: ContactInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }

  const problem = validateContact(input);
  if (problem === "spam") return reply({ ok: true }); // don't tell bots they were caught
  if (problem) return reply({ ok: false, error: problem }, 422);
  if (limited(`contact:${clientIp(req)}`)) return reply({ ok: false, error: "Too many messages from here — please try again in a few minutes." }, 429);

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const inbox = CLUB.email || process.env.SMTP_USER || "";
  const canEmail = emailConfigured() && !!inbox;
  if (!(URL && KEY) && !canEmail) return reply({ ok: false, error: "Messages aren't connected yet — please message us on WhatsApp or Instagram." }, 503);

  const name = input.name.trim(), email = input.email.trim().toLowerCase(), handle = cleanHandle(input.handle ?? "") || undefined, message = input.message.trim();
  const kindLabel = KINDS.find((k) => k.id === input.kind)!.label;

  if (URL && KEY) {
    const { error } = await createClient(URL, KEY, { auth: { persistSession: false } }).from("messages").insert({ kind: input.kind, name, email, handle: handle ?? null, message });
    if (error) return reply({ ok: false, error: "Couldn't save that — please try again." }, 502);
  }
  if (canEmail) {
    const note = await sendEmail(inbox, contactNotification({ kindLabel, name, email, handle, message, site: SITE_URL }), { replyTo: email });
    if (!note.sent) console.error("contact notification failed:", note.reason === "failed" ? note.error : note.reason);
    await sendEmail(email, contactAck({ name, kindLabel, site: SITE_URL })); // best effort
  }
  return reply({ ok: true }, 201);
}
