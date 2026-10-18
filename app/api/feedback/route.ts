import { validateFeedback, type FeedbackInput, type FeedbackResult } from "@/lib/feedback";
import { rateLimited } from "@/lib/ratelimit";
import { serverDb } from "@/lib/supabase-server";

/* POST /api/feedback — anonymous event feedback saved to Supabase (through submit_feedback). */
const reply = (b: FeedbackResult, status = 200) => Response.json(b, { status });

export async function POST(req: Request) {
  let input: FeedbackInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }
  const problem = validateFeedback(input);
  if (problem === "spam") return reply({ ok: true });
  if (problem) return reply({ ok: false, error: problem }, 422);
  if (await rateLimited(req, "feedback", 12)) return reply({ ok: false, error: "Too many submissions from here. Please try again later." }, 429);

  const db = serverDb();
  if (!db) return reply({ ok: false, error: "Feedback isn't connected yet. Tell us on WhatsApp instead." }, 503);
  const { data, error } = await db.rpc("submit_feedback", { p_event: input.event, p_rating: input.rating, p_liked: input.liked?.trim() || null, p_improve: input.improve?.trim() || null });
  if (error) return reply({ ok: false, error: "Couldn't save that. Please try again." }, 502);
  if (data === "busy") return reply({ ok: false, error: "Lots of feedback right now. Please try again in a little while." }, 429);
  return reply({ ok: true }, 201);
}
