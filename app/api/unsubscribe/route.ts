import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@/lib/email/token";

/* Unsubscribe from club emails. Works three ways:
   POST (mail apps' one-click button), GET (redirects to the confirmation page), form POST from that page. */
async function unsubscribe(email: string, token: string) {
  if (!email || !verifyToken(email, token)) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const { error } = await createClient(url, key, { auth: { persistSession: false } }).rpc("unsubscribe_join", { p_email: email });
  return !error;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  return Response.redirect(new URL(`/unsubscribe?e=${encodeURIComponent(u.searchParams.get("e") ?? "")}&t=${encodeURIComponent(u.searchParams.get("t") ?? "")}`, u), 303);
}

export async function POST(req: Request) {
  const u = new URL(req.url);
  let e = u.searchParams.get("e") ?? "", t = u.searchParams.get("t") ?? "", fromPage = false;
  try { // our confirmation page posts e and t as form fields; a mail app's one-click POST doesn't
    const f = await req.formData();
    if (f.get("e")) { e = String(f.get("e")); t = String(f.get("t") ?? ""); fromPage = true; }
  } catch { /* no form body */ }
  const ok = await unsubscribe(e, t);
  if (fromPage) return Response.redirect(new URL(`/unsubscribe?${ok ? "done=1" : "bad=1"}`, u), 303);
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
