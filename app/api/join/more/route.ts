import { cleanHandle, validateMore, type MoreInput } from "@/lib/join";
import { verifyToken } from "@/lib/email/token";
import { rateLimited } from "@/lib/ratelimit";
import { serverDb } from "@/lib/supabase-server";

/* POST /api/join/more — the optional second step of joining: a GitHub username and/or the event they'd like to try
   first. Only with the signed key that joining returned (and the welcome email carries), so nobody can change someone
   else's sign-up by knowing their email. */
const reply = (body: { ok: boolean; error?: string }, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let input: MoreInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }
  const problem = validateMore(input);
  if (problem) return reply({ ok: false, error: problem }, 422);
  if (!verifyToken(input.email, input.token)) return reply({ ok: false, error: "That link has expired. Join again with the same email to get a fresh one." }, 403);
  if (await rateLimited(req, "join-more", 10)) return reply({ ok: false, error: "Too many tries from here. Try again in a few minutes." }, 429);
  const db = serverDb();
  if (!db) return reply({ ok: false, error: "Sign-ups are not connected yet." }, 503);
  const { data, error } = await db.rpc("finish_join", { p_email: input.email.trim().toLowerCase(), p_handle: cleanHandle(input.handle ?? ""), p_first_event: input.firstEvent ?? "" });
  if (error) return reply({ ok: false, error: "Couldn't save that. Please try again." }, 502);
  if (data === "missing") return reply({ ok: false, error: "We couldn't find that sign-up. Join again with the same email." }, 404);
  return reply({ ok: true });
}
