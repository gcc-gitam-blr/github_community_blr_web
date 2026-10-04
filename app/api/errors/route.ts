import { createClient } from "@supabase/supabase-js";
import { cleanReport } from "@/lib/client-errors";
import { rateLimited } from "@/lib/ratelimit";

/* POST /api/errors — an error from a visitor's browser (components/ui/ErrorReporter.tsx). Cleaned again here,
   rate-limited, and stored through log_client_error (supabase/schema.sql); admins read them on /admin.
   The browser never needs an answer, so it always gets an empty one. Without Supabase it does nothing. */
const done = (status = 204) => new Response(null, { status });

export async function POST(req: Request) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !KEY) return done();
  const text = await req.text().catch(() => "");
  if (!text || text.length > 8000) return done(400);
  let body: unknown; try { body = JSON.parse(text); } catch { return done(400); }
  const report = cleanReport(body, req.headers.get("user-agent") ?? "");
  if (!report) return done(400);
  if (await rateLimited(req, "errors", 20)) return done(429); // one broken phone can't fill the table
  const { error } = await createClient(URL, KEY, { auth: { persistSession: false } }).rpc("log_client_error", { p_message: report.message, p_stack: report.stack, p_path: report.path, p_browser: report.browser });
  if (error) console.error("client error report not saved:", error.message);
  return done();
}
