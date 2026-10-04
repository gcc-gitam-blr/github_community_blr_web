import { createClient } from "@supabase/supabase-js";
import { cronAuthorized } from "@/lib/cron";

/* GET /api/cron/retention — deletes personal data older than the privacy page promises (prune_old_data in
   supabase/schema.sql; the periods are in lib/retention.ts). Vercel calls it weekly (vercel.json "crons")
   with "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET set, or with the wrong one, it refuses. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ ok: false, error: "CRON_SECRET isn't set, so this job is switched off." }, { status: 503 });
  if (!cronAuthorized(req.headers.get("authorization"))) return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !KEY) return Response.json({ ok: true, skipped: "The database isn't connected, so there's nothing to delete." });
  const { data, error } = await createClient(URL, KEY, { auth: { persistSession: false } }).rpc("prune_old_data");
  if (error) { console.error("retention job failed:", error.message || error); return Response.json({ ok: false, error: error.message || "The database refused." }, { status: 502 }); }
  return Response.json({ ok: true, deleted: data });
}
