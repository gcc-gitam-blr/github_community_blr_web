import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { STATE_COOKIE, githubIdentity, loginEnv, loginToken, ownLoginActive, safeNext, type AuthAdmin } from "@/lib/auth/github-login";
import { clientIp, limited } from "@/lib/ratelimit";

/* GET /api/auth/github/callback — GitHub sends people here after they approve. We check it's the same
   browser that started (state cookie), find or create their account, and send them back signed in. */
export async function GET(req: Request) {
  const url = new URL(req.url), env = loginEnv();
  const cookie = req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${STATE_COOKIE}=([^;]+)`))?.[1] ?? "";
  const [state, rawNext] = decodeURIComponent(cookie).split("|"); // Next.js URL-encodes cookie values
  const next = safeNext(rawNext);
  const back = (hash: string) => { const r = NextResponse.redirect(new URL(`${next}#${hash}`, url.origin)); r.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/github" }); return r; };
  const fail = (msg: string) => back(`login_error=${encodeURIComponent(msg)}`);

  if (url.searchParams.get("error")) return fail("Sign-in was cancelled.");
  if (!ownLoginActive(env, url.origin)) return fail("GitHub sign-in isn't set up on this address.");
  if (limited(`login:${clientIp(req)}`, 60)) return fail("Too many sign-in attempts — please wait a few minutes."); // generous: a whole campus can share one IP
  const code = url.searchParams.get("code");
  if (!code || !state || url.searchParams.get("state") !== state) return fail("That sign-in link expired. Please try again.");

  const who = await githubIdentity(env, url.origin, code);
  if (!who.ok) return fail(who.error);
  const admin = createClient(env.supabaseUrl!, env.serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin as unknown as AuthAdmin;
  const login = await loginToken(admin, who.user, who.email);
  if (!login.ok) return fail(login.error);
  return back(`sb_token=${encodeURIComponent(login.token)}`);
}
