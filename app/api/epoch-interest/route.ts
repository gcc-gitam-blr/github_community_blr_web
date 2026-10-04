import { createClient } from "@supabase/supabase-js";
import { validateInterest, type InterestInput, type InterestResult } from "@/lib/interest";
import { clientIp, limited } from "@/lib/ratelimit";

/* POST /api/epoch-interest — "notify me when Epoch dates are announced". Stored through the database function
   epoch_interest_join (the table itself is admin-only); organisers email the list from the broadcast tool. */
const reply = (body: InterestResult, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let input: InterestInput;
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Bad request." }, 400); }
  const problem = validateInterest(input);
  if (problem === "spam") return reply({ ok: true, status: "created" }); // don't tell bots they were caught
  if (problem) return reply({ ok: false, error: problem }, 422);
  if (limited(`interest:${clientIp(req)}`)) return reply({ ok: false, error: "Too many tries from here — please try again in a few minutes." }, 429);

  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !KEY) return reply({ ok: false, error: "This list isn't switched on yet, so nothing was saved. The dates will be on this page and in our WhatsApp community.", off: true }, 503);
  const { data, error } = await createClient(URL, KEY, { auth: { persistSession: false } }).rpc("epoch_interest_join", { p_email: input.email.trim().toLowerCase() });
  if (error) return reply({ ok: false, error: "Couldn't save that — please try again." }, 502);
  return data === "exists" || data === "unsubscribed" ? reply({ ok: true, status: data }) : reply({ ok: true, status: "created" }, 201);
}
