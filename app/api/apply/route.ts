import { CLUB } from "@/lib/config";
import { cleanAnswers, validateApplication, type ApplyInput, type ApplyResult } from "@/lib/apply";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { contactAck } from "@/lib/email/templates";
import { cleanHandle } from "@/lib/join";
import { rateLimited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";
import { serverDb } from "@/lib/supabase-server";

/* /api/apply: core-team applications.
   GET  → which recruitment round is open right now (the page shows the form, or a "closed" note).
   POST → saves an application through the database function submit_application (server key only), which checks the
          round is open on its dates, refuses a second application with the same email, and caps a runaway script. */
export const dynamic = "force-dynamic";
const reply = (body: ApplyResult | { open: boolean; campaign?: { id: number; name: string; closesOn: string } }, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const db = serverDb();
  if (!db) return reply({ open: false });
  const { data, error } = await db.rpc("open_campaign");
  if (error || !data) return reply({ open: false });
  return reply({ open: true, campaign: { id: data.id, name: data.name, closesOn: data.closes_on } });
}

export async function POST(req: Request) {
  let input: ApplyInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }
  const problem = validateApplication(input);
  if (problem === "spam") return reply({ ok: true, status: "created" }); // don't tell bots they were caught
  if (problem) return reply({ ok: false, error: problem }, 422);
  if (await rateLimited(req, "apply", 5)) return reply({ ok: false, error: "Too many tries from here — please try again in a few minutes." }, 429);

  const db = serverDb();
  if (!db) return reply({ ok: false, error: "Applications aren't switched on yet.", closed: true }, 503);
  const { data, error } = await db.rpc("submit_application", {
    p_campaign: input.campaign, p_name: input.name.trim(), p_email: input.email.trim().toLowerCase(), p_handle: cleanHandle(input.handle),
    p_team: input.team || null, p_answers: cleanAnswers(input.answers),
  });
  if (error) return reply({ ok: false, error: "Couldn't save that — please try again." }, 502);
  if (data === "closed") return reply({ ok: false, error: "Applications are closed.", closed: true }, 409);
  if (data === "busy") return reply({ ok: false, error: "Lots of applications right now — please try again in a little while." }, 429);
  if (data === "created" && emailConfigured() && (CLUB.email || process.env.SMTP_USER)) {
    await sendEmail(input.email.trim().toLowerCase(), contactAck({ name: input.name.trim(), kindLabel: "Core team application", site: SITE_URL })); // best effort
  }
  return reply({ ok: true, status: data === "exists" ? "exists" : "created" }, data === "created" ? 201 : 200);
}
