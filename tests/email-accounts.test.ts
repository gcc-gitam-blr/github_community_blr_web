/* Accounts without GitHub (Epoch's email code) next to GitHub accounts, in supabase/schema.sql run in PGlite.
   The rule: a GitHub username is only ever taken from where the server or GitHub wrote it (github_login()), never from
   user_metadata, which a signed-in user can change. An email-only account gets a "~" handle GitHub can't have, so it
   can't pick up access meant for a GitHub username, a member record by username, or someone else's certificates. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { AUTH_USERS } from "./auth-stub";

const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
const register = async (uid: string, name = "Someone") => { await as(uid); return one<{ handle: string; role: string }>("select (register_profile($1)).*", [name]); };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const EMAIL_VIC = id(1), EMAIL_VIC2 = id(2), GH_VIC = id(3), IDENTITY = id(4), LATER = id(5), TAKEN = id(6);

(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    ${AUTH_USERS}
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  // email-code accounts: no user_name anywhere; GitHub accounts: the stub fills app_metadata as the server's sign-in does
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
    ($1, 'vic@gitam.in', '{}'), ($2, 'vic@gmail.com', '{}'), ($3, 'real.vic@gitam.in', '{"user_name":"vic"}'),
    ($4, 'id@gitam.in', '{}'), ($5, 'later@gitam.in', '{}'), ($6, 'taken@gitam.in', '{}')`, [EMAIL_VIC, EMAIL_VIC2, GH_VIC, IDENTITY, LATER, TAKEN]);
  // Supabase's own GitHub sign-in (previews): the username is in the GitHub identity, not app_metadata
  await db.query(`insert into auth.identities (user_id, provider, identity_data) values ($1, 'github', '{"user_name":"id-user"}')`, [IDENTITY]);

  // waiting for "vic": access granted before their first sign-in, a member record, and a certificate
  await db.query("insert into pending_roles (handle, role, ends_on) values ('vic', 'core', today_ist() + 30)");
  await db.query("insert into members (handle, name, email) values ('vic', 'Vic Real', 'real.vic@gitam.in')");
  await db.query("insert into members (name, email) values ('Vic Email', 'vic@gitam.in')");
  await db.query("insert into attendance (event, name, email, handle) values ('2026-10-12', 'Vic Real', 'someone@else.in', 'vic')");

  // a signed-in user can write anything into their own user_metadata: say it's "vic"
  await db.query(`update auth.users set raw_user_meta_data = '{"user_name":"vic","full_name":"Vic"}' where id = $1`, [EMAIL_VIC]);
  const e = await register(EMAIL_VIC, "Vic by email");
  ok("an email-code account gets a handle GitHub can't have", e.handle === "~vic");
  ok("…even after writing someone's username into its own user_metadata", e.handle !== "vic");
  ok("…and doesn't pick up access waiting for that GitHub username", e.role === "attendee" && (await one<{ n: number }>("select count(*)::int n from pending_roles where handle = 'vic'")).n === 1);
  ok("…or the member record that has that username", (await one<{ u: string | null }>("select user_id u from members where handle = 'vic'")).u === null);
  ok("…but is linked to the member record with its own email", (await one<{ u: string | null }>("select user_id u from members where email = 'vic@gitam.in'")).u === EMAIL_VIC);
  await as(EMAIL_VIC);
  ok("…and My club doesn't show it certificates matched by that username", (await db.query("select * from my_attendance()")).rows.length === 0);

  ok("two addresses that start the same get different handles", (await register(EMAIL_VIC2)).handle === "~vic-2");

  const g = await register(GH_VIC, "Vic Real");
  ok("the real GitHub user gets the username", g.handle === "vic");
  ok("…and the access that was waiting for it", g.role === "core" && (await one<{ n: number }>("select count(*)::int n from pending_roles where handle = 'vic'")).n === 0);
  ok("…and the member record with that username", (await one<{ u: string | null }>("select user_id u from members where handle = 'vic'")).u === GH_VIC);
  await as(GH_VIC);
  ok("…and the certificate matched by that username", (await db.query("select * from my_attendance()")).rows.length === 1);

  ok("Supabase's own GitHub sign-in is read from the GitHub identity", (await register(IDENTITY)).handle === "id-user");

  // signed in with an email code first, then with GitHub: the GitHub username takes over, if nobody has it
  ok("an email-code account starts with a ~ handle", (await register(LATER)).handle === "~later");
  await db.query(`update auth.users set raw_app_meta_data = '{"github_login":"later-gh"}' where id = $1`, [LATER]);
  ok("…and gets its GitHub username when it signs in with GitHub", (await register(LATER)).handle === "later-gh");
  await register(TAKEN);
  await db.query(`update auth.users set raw_app_meta_data = '{"github_login":"vic"}' where id = $1`, [TAKEN]);
  ok("…but never one another profile already has", (await register(TAKEN)).handle === "~taken");

  // github_login() itself: for the database's own use only
  const canRun = async (role: string) => (await one<{ r: boolean }>("select has_function_privilege($1, 'github_login(uuid)', 'execute') r", [role])).r;
  ok("nobody signed in (or not) can call github_login() directly", !(await canRun("anon")) && !(await canRun("authenticated")));

  if (fails) { console.log(`${fails} email-account check(s) failed`); process.exit(1); }
  console.log("all email-account checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
