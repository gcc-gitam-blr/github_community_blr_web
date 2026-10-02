import { randomBytes } from "node:crypto";

/* "Sign in with GitHub" on the club's own domain.
   GitHub sends people back to <site>/api/auth/github/callback (not to the Supabase project address, which
   browsers' phishing filters can flag). The server then finds or creates the Supabase user with the service
   role key and hands the browser a one-time login token in the URL fragment; the page exchanges it for a session.
   Off by default: without GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and SUPABASE_SERVICE_ROLE_KEY — or on a
   preview/localhost address GitHub doesn't know — sign-in falls back to Supabase's own GitHub flow. */

export interface LoginEnv { clientId?: string; clientSecret?: string; serviceKey?: string; supabaseUrl?: string; origin?: string }
export const loginEnv = (): LoginEnv => ({
  clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  origin: process.env.GITHUB_OAUTH_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
});

/** Our own flow is used only when it's configured and we're on the address registered with GitHub. */
export const ownLoginActive = (env: LoginEnv, requestOrigin: string) =>
  !!(env.clientId && env.clientSecret && env.serviceKey && env.supabaseUrl && env.origin) && env.origin.replace(/\/$/, "") === requestOrigin;

/** Only same-site paths, so the login can't be used to bounce people to another website. */
export const safeNext = (next: string | null | undefined) => (next && /^\/(?![/\\])[\w\-./?=&%#]*$/.test(next) ? next : "/epoch/register");

export const STATE_COOKIE = "gh_login";
export const newState = () => randomBytes(18).toString("base64url");

export function authorizeUrl(env: LoginEnv, origin: string, state: string) {
  const q = new URLSearchParams({ client_id: env.clientId!, redirect_uri: `${origin}/api/auth/github/callback`, scope: "read:user user:email", state, allow_signup: "true" });
  return `https://github.com/login/oauth/authorize?${q}`;
}
/** Supabase's own GitHub flow (used for previews and local development). */
export const supabaseAuthorizeUrl = (supabaseUrl: string, origin: string, next: string) =>
  `${supabaseUrl.replace(/\/$/, "")}/auth/v1/authorize?${new URLSearchParams({ provider: "github", redirect_to: `${origin}${next}` })}`;

export interface GitHubUser { id: number; login: string; name: string | null; avatar_url: string; email: string | null }

/** Swaps GitHub's one-time code for the person's GitHub account and verified email. */
export async function githubIdentity(env: LoginEnv, origin: string, code: string, f: typeof fetch = fetch): Promise<{ ok: true; user: GitHubUser; email: string } | { ok: false; error: string }> {
  const t = await f("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.clientId, client_secret: env.clientSecret, code, redirect_uri: `${origin}/api/auth/github/callback` }),
  });
  const tok = (await t.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!tok.access_token) return { ok: false, error: tok.error_description || "GitHub didn't accept the sign-in. Please try again." };
  const h = { Authorization: `Bearer ${tok.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "github-community-blr" };
  const user = (await (await f("https://api.github.com/user", { headers: h })).json()) as GitHubUser;
  const emails = (await (await f("https://api.github.com/user/emails", { headers: h })).json().catch(() => [])) as { email: string; primary: boolean; verified: boolean }[];
  const list = Array.isArray(emails) ? emails : [];
  const email = (list.find((e) => e.primary && e.verified) ?? list.find((e) => e.verified))?.email;
  if (!user?.login) return { ok: false, error: "Couldn't read your GitHub account. Please try again." };
  if (!email) return { ok: false, error: "Your GitHub account has no verified email. Add one at github.com/settings/emails, then sign in again." };
  return { ok: true, user, email: email.toLowerCase() };
}

/** The part of Supabase's admin API we use (so tests can pass a fake). */
export interface AuthAdmin {
  createUser(a: { email: string; email_confirm: boolean; user_metadata: object }): Promise<{ data: { user: { id: string } | null }; error: { message: string; code?: string; status?: number } | null }>;
  generateLink(a: { type: "magiclink"; email: string }): Promise<{ data: { user: { id: string } | null; properties: { hashed_token: string } | null }; error: { message: string } | null }>;
  updateUserById(id: string, a: { user_metadata: object }): Promise<{ error: { message: string } | null }>;
}

/** Finds or creates the Supabase user for this GitHub account and returns a one-time login token. */
export async function loginToken(admin: AuthAdmin, gh: GitHubUser, email: string): Promise<{ ok: true; token: string; userId: string } | { ok: false; error: string }> {
  // the same keys Supabase's own GitHub provider writes, so register_profile reads the handle either way
  const meta = { user_name: gh.login, preferred_username: gh.login, full_name: gh.name ?? gh.login, name: gh.name ?? gh.login, avatar_url: gh.avatar_url, provider_id: String(gh.id) };
  const created = await admin.createUser({ email, email_confirm: true, user_metadata: meta });
  const exists = created.error && (created.error.code === "email_exists" || /already (been )?registered|already exists/i.test(created.error.message));
  if (created.error && !exists) return { ok: false, error: "Couldn't create your account. Please try again." };
  const link = await admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data.user || !link.data.properties) return { ok: false, error: "Couldn't sign you in. Please try again." };
  if (exists) await admin.updateUserById(link.data.user.id, { user_metadata: meta }); // keep handle/avatar current
  return { ok: true, token: link.data.properties.hashed_token, userId: link.data.user.id };
}
