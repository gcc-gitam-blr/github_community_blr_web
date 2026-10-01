import { createClient } from "@supabase/supabase-js";
import { validateFeedback, type FeedbackInput, type FeedbackResult } from "@/lib/feedback";
import { clientIp, limited } from "@/lib/ratelimit";

/* POST /api/feedback — anonymous event feedback saved to Supabase (table event_feedback). */
const reply = (b: FeedbackResult, status = 200) => Response.json(b, { status });

export async function POST(req: Request) {
  let input: FeedbackInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }
  const problem = validateFeedback(input);
  if (problem === "spam") return reply({ ok: true });
  if (problem) return reply({ ok: false, error: problem }, 422);
  if (limited(`feedback:${clientIp(req)}`, 12)) return reply({ ok: false, error: "Too many submissions from here — please try again later." }, 429);

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !KEY) return reply({ ok: false, error: "Feedback isn't connected yet — tell us on WhatsApp instead." }, 503);
  const { error } = await createClient(URL, KEY, { auth: { persistSession: false } }).from("event_feedback").insert({ event: input.event, rating: input.rating, liked: input.liked?.trim() || null, improve: input.improve?.trim() || null });
  if (error) return reply({ ok: false, error: "Couldn't save that — please try again." }, 502);
  return reply({ ok: true }, 201);
}
