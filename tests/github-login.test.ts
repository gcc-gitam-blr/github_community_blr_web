/* "Sign in with GitHub" on our own domain: which flow runs, safe redirects, GitHub's answers, and finding/creating
   the Supabase user — against fake GitHub and Supabase services. */
import { authorizeUrl, githubIdentity, loginToken, ownLoginActive, safeNext, supabaseAuthorizeUrl, type AuthAdmin, type LoginEnv } from "../lib/auth/github-login";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SITE = "https://githubcommunityblr.vercel.app";
const env: LoginEnv = { clientId: "cid", clientSecret: "secret", serviceKey: "service", supabaseUrl: "https://ref.supabase.co", origin: SITE + "/" };

(async () => {
  // which flow
  ok("our flow runs on the registered address", ownLoginActive(env, SITE));
  ok("previews and localhost use Supabase's flow", !ownLoginActive(env, "https://githubcommunityblr-git-dev-x.vercel.app") && !ownLoginActive(env, "http://localhost:3000"));
  ok("without the service key it stays off", !ownLoginActive({ ...env, serviceKey: undefined }, SITE));

  // redirects stay on our site
  ok("a normal path is kept", safeNext("/admin") === "/admin" && safeNext("/epoch/register?x=1") === "/epoch/register?x=1");
  ok("other sites are refused", ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null].every((n) => safeNext(n) === "/epoch/register"));

  const a = new URL(authorizeUrl(env, SITE, "st4te"));
  ok("GitHub is asked to return to our callback with our state", a.origin === "https://github.com" && a.searchParams.get("redirect_uri") === `${SITE}/api/auth/github/callback` && a.searchParams.get("state") === "st4te" && a.searchParams.get("client_id") === "cid");
  ok("only profile + email permissions are requested", a.searchParams.get("scope") === "read:user user:email");
  const s = new URL(supabaseAuthorizeUrl("https://ref.supabase.co/", "http://localhost:3000", "/admin"));
  ok("the fallback asks Supabase to return to the same page", s.searchParams.get("provider") === "github" && s.searchParams.get("redirect_to") === "http://localhost:3000/admin");

  // GitHub's side
  const gh = (o: { token?: string; emails?: object; user?: object }) => (async (u: string, i?: RequestInit) => {
    if (u.includes("access_token")) { const b = JSON.parse(i!.body as string); return Response.json(b.code === "good" && b.client_secret === "secret" ? { access_token: o.token ?? "tok" } : { error: "bad_verification_code", error_description: "The code passed is incorrect or expired." }); }
    if (u.endsWith("/user")) return Response.json(o.user ?? { id: 7, login: "Ada-L", name: "Ada Lovelace", avatar_url: "https://a/x.png", email: null });
    return Response.json(o.emails ?? [{ email: "old@x.in", primary: false, verified: true }, { email: "Ada@GITAM.in", primary: true, verified: true }]);
  }) as typeof fetch;
  const who = await githubIdentity(env, SITE, "good", gh({}));
  ok("the primary verified email is used, lowercased", who.ok && who.email === "ada@gitam.in" && who.user.login === "Ada-L");
  const bad = await githubIdentity(env, SITE, "expired", gh({}));
  ok("an expired code says so", !bad.ok && /incorrect or expired/.test(bad.error));
  const noMail = await githubIdentity(env, SITE, "good", gh({ emails: [{ email: "x@y.in", primary: true, verified: false }] }));
  ok("no verified email → tells them where to add one", !noMail.ok && /settings\/emails/.test(noMail.error));

  // Supabase's side
  const users = new Map<string, { id: string; meta: Record<string, string> }>();
  const admin: AuthAdmin = {
    async createUser({ email, user_metadata }) {
      if (users.has(email)) return { data: { user: null }, error: { message: "A user with this email address has already been registered", code: "email_exists", status: 422 } };
      const u = { id: `u${users.size + 1}`, meta: user_metadata as Record<string, string> }; users.set(email, u); return { data: { user: { id: u.id } }, error: null };
    },
    async generateLink({ email }) { const u = users.get(email); return u ? { data: { user: { id: u.id }, properties: { hashed_token: `tok-${u.id}-${Math.random()}` } }, error: null } : { data: { user: null, properties: null }, error: { message: "User not found" } }; },
    async updateUserById(id, { user_metadata }) { for (const u of users.values()) if (u.id === id) u.meta = user_metadata as Record<string, string>; return { error: null }; },
  };
  if (!who.ok) throw new Error("setup");
  const first = await loginToken(admin, who.user, who.email);
  ok("a new person gets an account and a one-time token", first.ok && first.userId === "u1" && first.token.startsWith("tok-u1"));
  ok("their GitHub handle is stored where register_profile reads it", users.get("ada@gitam.in")!.meta.user_name === "Ada-L");
  const again = await loginToken(admin, { ...who.user, login: "ada-renamed" }, who.email);
  ok("signing in again reuses the same account", again.ok && again.userId === "u1" && users.size === 1);
  ok("…and refreshes a changed GitHub handle", users.get("ada@gitam.in")!.meta.user_name === "ada-renamed");
  const broken = await loginToken({ ...admin, createUser: async () => ({ data: { user: null }, error: { message: "Database error" } }) }, who.user, "new@x.in");
  ok("a database failure is a friendly error, not a crash", !broken.ok && /try again/.test(broken.error));

  if (fails) { console.log(`${fails} login check(s) failed`); process.exit(1); }
  console.log("all login checks passed");
})();
