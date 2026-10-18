import { CLUB } from "@/lib/config";
import { DEFAULT_QUESTIONS, DEFAULT_TEAMS, answersProblem, basicProblem, cleanAnswers, type ApplyInput, type ApplyResult, type OpenCampaign, type Question } from "@/lib/apply";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { contactAck } from "@/lib/email/templates";
import { cleanHandle } from "@/lib/join";
import { rateLimited } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/site";
import { serverDb } from "@/lib/supabase-server";

/* /api/apply: core-team applications.
   GET  → which recruitment round is open right now, with its form (the page shows it, or a "closed" note).
   POST → checks the answers against that round's questions, then saves the application through the database function
          submit_application (server key only), which checks again, checks the round is open on its dates, refuses a
          second application with the same email, and caps a runaway script. */
export const dynamic = "force-dynamic";
const reply = (body: ApplyResult | { open: boolean; campaign?: OpenCampaign }, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
type Row = { id: number; name: string; closes_on: string; intro?: string | null; questions?: Question[] | null; teams?: string[] | null };
/** The open round as the form needs it; rounds from before forms existed get the first form's questions. */
const toRound = (d: Row): OpenCampaign => ({
  id: d.id, name: d.name, closesOn: d.closes_on, intro: d.intro ?? null,
  questions: Array.isArray(d.questions) && d.questions.length ? d.questions : DEFAULT_QUESTIONS,
  teams: Array.isArray(d.teams) ? d.teams : DEFAULT_TEAMS,
});

export async function GET() {
  const db = serverDb();
  if (!db) return reply({ open: false });
  const { data, error } = await db.rpc("open_campaign");
  if (error || !data) return reply({ open: false });
  return reply({ open: true, campaign: toRound(data as Row) });
}

export async function POST(req: Request) {
  let input: ApplyInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }
  const basic = basicProblem(input);
  if (basic === "spam") return reply({ ok: true, status: "created" }); // don't tell bots they were caught
  if (basic) return reply({ ok: false, error: basic }, 422);
  if (await rateLimited(req, "apply", 5)) return reply({ ok: false, error: "Too many tries from here. Please try again in a few minutes." }, 429);

  const db = serverDb();
  if (!db) return reply({ ok: false, error: "Applications aren't switched on yet.", closed: true }, 503);
  const { data: open, error: openError } = await db.rpc("open_campaign");
  if (openError) return reply({ ok: false, error: "Couldn't save that. Please try again." }, 502);
  if (!open || (open as Row).id !== input.campaign) return reply({ ok: false, error: "Applications are closed.", closed: true }, 409);
  const round = toRound(open as Row);
  const problem = answersProblem(input, round);
  if (problem) return reply({ ok: false, error: problem }, 422);

  const { data, error } = await db.rpc("submit_application", {
    p_campaign: input.campaign, p_name: input.name.trim(), p_email: input.email.trim().toLowerCase(), p_handle: cleanHandle(input.handle),
    p_team: input.team || null, p_answers: cleanAnswers(input.answers, round.questions),
  });
  if (error) return reply({ ok: false, error: "Couldn't save that. Please try again." }, 502);
  if (data === "closed") return reply({ ok: false, error: "Applications are closed.", closed: true }, 409);
  if (data === "busy") return reply({ ok: false, error: "Lots of applications right now. Please try again in a little while." }, 429);
  if (data === "incomplete") return reply({ ok: false, error: "Please answer every question marked as required." }, 422);
  if (data === "created" && emailConfigured() && (CLUB.email || process.env.SMTP_USER)) {
    await sendEmail(input.email.trim().toLowerCase(), contactAck({ name: input.name.trim(), kindLabel: "Core team application", site: SITE_URL })); // best effort
  }
  return reply({ ok: true, status: data === "exists" ? "exists" : "created" }, data === "created" ? 201 : 200);
}
