/* The pieces behind `npm run connect`, kept separate so tests can run each against real local servers. */
import { randomBytes } from "node:crypto";

export type Fetch = typeof fetch;
export type Check = { ok: true; note?: string } | { ok: false; error: string };

/** Supabase project URL + anon (public) key: does the REST API answer with them? */
export async function checkSupabase(url: string, anonKey: string, f: Fetch = fetch): Promise<Check> {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) return { ok: false, error: "The project URL looks like https://abcdefgh.supabase.co" };
  try {
    const r = await f(`${url.replace(/\/$/, "")}/rest/v1/`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (r.status === 401 || r.status === 403) return { ok: false, error: "Supabase refused that anon key — copy the anon / public key from Project Settings → API." };
    return r.ok ? { ok: true } : { ok: false, error: `Supabase answered ${r.status}.` };
  } catch (e) { return { ok: false, error: `Couldn't reach Supabase: ${(e as Error).message}` }; }
}

/** Runs supabase/schema.sql over a Postgres connection string. The schema is safe to run again. */
export async function applySchema(connectionString: string, sql: string, opts: { ssl?: boolean } = {}): Promise<Check> {
  const { default: pg } = await import("pg");
  const db = new pg.Client({ connectionString, ssl: opts.ssl === false ? false : { rejectUnauthorized: false } });
  try {
    await db.connect();
    await db.query(sql);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from information_schema.tables where table_name in ('profiles','join_requests','messages','event_feedback','broadcasts')");
    return rows[0].n === 5 ? { ok: true } : { ok: false, error: `Only ${rows[0].n} of 5 tables exist after running the schema.` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  finally { await db.end().catch(() => {}); }
}

/** Makes a GitHub user an admin. They must have signed in to Epoch once so their profile exists. */
export async function makeAdmin(connectionString: string, handle: string, opts: { ssl?: boolean } = {}): Promise<Check> {
  const { default: pg } = await import("pg");
  const db = new pg.Client({ connectionString, ssl: opts.ssl === false ? false : { rejectUnauthorized: false } });
  try {
    await db.connect();
    const r = await db.query("update profiles set role = 'admin' where lower(handle) = lower($1)", [handle.replace(/^@/, "")]);
    return r.rowCount ? { ok: true } : { ok: false, error: `No profile for @${handle} yet — sign in once at /epoch/register with GitHub, then run this again.` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  finally { await db.end().catch(() => {}); }
}

export type Smtp = { host: string; port: number; user: string; pass: string; secure?: boolean };

/** Logs in to the mail server and sends one test email to `to`. */
export async function checkEmail(s: Smtp, from: string, to: string): Promise<Check> {
  const nodemailer = (await import("nodemailer")).default;
  const t = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.secure ?? s.port === 465, auth: { user: s.user, pass: s.pass }, tls: s.host === "127.0.0.1" ? { rejectUnauthorized: false } : undefined });
  try {
    await t.verify();
    await t.sendMail({ from, to, subject: "Your club website can send email ✓", text: "This is a test from `npm run connect`. Sign-up welcomes, Get involved messages and broadcasts will now be delivered.\n\n— the website" });
    return { ok: true };
  } catch (e) {
    const m = (e as Error).message;
    if (/Invalid login|535|Username and Password not accepted/i.test(m)) return { ok: false, error: "Gmail refused the login. Use a 16-letter App Password (myaccount.google.com/apppasswords), not your normal password. 2-Step Verification must be on." };
    return { ok: false, error: m };
  }
}

/** Updates KEY=value lines in a .env file, keeping comments and other keys as they are. */
export function mergeEnv(text: string, vars: Record<string, string>): string {
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).map((l) => {
    const k = l.match(/^([A-Z0-9_]+)=/)?.[1];
    if (k && k in vars) { seen.add(k); return `${k}=${quote(vars[k])}`; }
    return l;
  });
  const extra = Object.keys(vars).filter((k) => !seen.has(k)).map((k) => `${k}=${quote(vars[k])}`);
  return [...lines.filter((l, i, a) => !(i === a.length - 1 && l === "")), ...extra].join("\n") + "\n";
}
const quote = (v: string) => (/[\s#"'<>]/.test(v) ? `"${v.replace(/"/g, '\\"')}"` : v);

export const newSecret = () => randomBytes(32).toString("base64url");

/** Saves environment variables on the Vercel project (production + preview), replacing old values. */
export async function pushVercel(token: string, project: string, vars: Record<string, string>, opts: { team?: string; f?: Fetch } = {}): Promise<Check> {
  const f = opts.f ?? fetch;
  const q = new URLSearchParams({ upsert: "true", ...(opts.team ? { teamId: opts.team } : {}) });
  const body = Object.entries(vars).map(([key, value]) => ({ key, value, type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted", target: ["production", "preview"] }));
  try {
    const r = await f(`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/env?${q}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 404) return { ok: false, error: `Vercel has no project called "${project}" for this token.` };
    if (r.status === 401 || r.status === 403) return { ok: false, error: "Vercel refused the token — make one at vercel.com/account/tokens." };
    return r.ok ? { ok: true } : { ok: false, error: `Vercel answered ${r.status}: ${(await r.text()).slice(0, 200)}` };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
