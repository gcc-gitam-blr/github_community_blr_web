import { NextResponse } from "next/server";
import { STATE_COOKIE, authorizeUrl, loginEnv, newState, ownLoginActive, safeNext, supabaseAuthorizeUrl } from "@/lib/auth/github-login";

/* GET /api/auth/github?next=/epoch/register — starts "Sign in with GitHub" (see lib/auth/github-login.ts). */
export function GET(req: Request) {
  const url = new URL(req.url), next = safeNext(url.searchParams.get("next")), env = loginEnv();
  if (!ownLoginActive(env, url.origin)) {
    if (!env.supabaseUrl) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(supabaseAuthorizeUrl(env.supabaseUrl, url.origin, next));
  }
  const state = newState();
  const res = NextResponse.redirect(authorizeUrl(env, url.origin, state));
  res.cookies.set(STATE_COOKIE, `${state}|${next}`, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/api/auth/github", maxAge: 600 });
  return res;
}
