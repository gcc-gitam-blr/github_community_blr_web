/* `npm run connect`, piece by piece, against real local servers:
   Postgres (PGlite behind a socket, so the `pg` driver talks the real wire protocol), an SMTP server, and fake Supabase/Vercel APIs. */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";
import { applySchema, checkEmail, checkSupabase, makeAdmin, mergeEnv, newSecret, pushVercel, type Fetch } from "../scripts/connect-lib";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const res = (status: number, body = "") => new Response(body, { status });

(async () => {
  // .env.local editing
  const before = "# Supabase\nNEXT_PUBLIC_SUPABASE_URL=\nKEEP=me\n";
  const after = mergeEnv(before, { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", EMAIL_FROM: "Club <c@gmail.com>" });
  ok("mergeEnv fills existing keys and keeps comments and other keys", after.startsWith("# Supabase\nNEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\nKEEP=me\n"));
  ok("mergeEnv appends new keys, quoting values with spaces", after.endsWith('EMAIL_FROM="Club <c@gmail.com>"\n'));
  ok("mergeEnv is stable when run twice", mergeEnv(after, { KEEP: "me" }) === after);
  ok("secrets are long and random", newSecret().length >= 40 && newSecret() !== newSecret());

  // Supabase keys
  ok("a non-Supabase URL is refused before any request", !(await checkSupabase("https://example.com", "k")).ok);
  ok("a wrong anon key is explained", /anon/.test(((await checkSupabase("https://abc.supabase.co", "k", (async () => res(401)) as Fetch)) as { error: string }).error));
  let seen = ""; const good = (async (u: string, i: RequestInit) => { seen = `${u} ${(i.headers as Record<string, string>).apikey}`; return res(200); }) as unknown as Fetch;
  ok("good keys pass and are sent as apikey", (await checkSupabase("https://abc.supabase.co/", "anon-1", good)).ok && seen === "https://abc.supabase.co/rest/v1/ anon-1");

  // the schema, over a real Postgres connection
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const port = (server as unknown as { server: { address(): AddressInfo } }).server.address().port;
  const conn = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  const sql = fs.readFileSync("supabase/schema.sql", "utf8");
  const first = await applySchema(conn, sql, { ssl: false });
  ok("the schema creates every table over the pg driver", first.ok);
  if (!first.ok) console.log(first.error);
  ok("…and running it again is fine", (await applySchema(conn, sql, { ssl: false })).ok);
  ok("a broken connection string is reported, not thrown", !(await applySchema("postgresql://nobody@127.0.0.1:1/x", sql, { ssl: false })).ok);
  ok("make-admin explains that the person must sign in first", /sign in once/.test(((await makeAdmin(conn, "ada", { ssl: false })) as { error: string }).error));
  await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@b.in', '{}');
    insert into profiles (id, handle, name) values ('00000000-0000-0000-0000-00000000000a', 'Ada', 'Ada');`);
  ok("make-admin promotes them (handle case doesn't matter)", (await makeAdmin(conn, "@ada", { ssl: false })).ok && (await db.query<{ role: string }>("select role from profiles")).rows[0].role === "admin");
  await server.stop();

  // email
  const got: string[] = [];
  const smtp = new SMTPServer({
    authOptional: false, disabledCommands: ["STARTTLS"], allowInsecureAuth: true,
    onAuth: (a, _s, cb) => (a.username === "club@gmail.com" && a.password === "abcdabcdabcdabcd" ? cb(null, { user: 1 }) : cb(Object.assign(new Error("535 5.7.8 Username and Password not accepted"), { responseCode: 535 }))),
    onData: (s, _x, cb) => { let d = ""; s.on("data", (c) => (d += c)); s.on("end", () => { got.push(d); cb(); }); },
  });
  const smtpPort = await new Promise<number>((r) => smtp.listen(0, "127.0.0.1", () => r((smtp.server.address() as AddressInfo).port)));
  const box = { host: "127.0.0.1", port: smtpPort, user: "club@gmail.com", secure: false };
  const bad = await checkEmail({ ...box, pass: "normal-password" }, "Club <club@gmail.com>", "club@gmail.com");
  ok("a normal password gets the App Password explanation", !bad.ok && /App Password/.test(bad.error));
  ok("an App Password logs in and sends the test email", (await checkEmail({ ...box, pass: "abcdabcdabcdabcd" }, "Club <club@gmail.com>", "club@gmail.com")).ok && got.length === 1 && /npm run connect/.test(got[0]));
  smtp.close();

  // Vercel
  type Call = { url: string; auth: string; body: { key: string; type: string; target: string[] }[] }; const calls: Call[] = [];
  const vercel = (async (u: string, i: RequestInit) => { calls.push({ url: u, auth: (i.headers as Record<string, string>).Authorization, body: JSON.parse(i.body as string) }); return res(201, "{}"); }) as unknown as Fetch;
  ok("Vercel variables are saved", (await pushVercel("tok", "github-community-blr", { NEXT_PUBLIC_SUPABASE_URL: "u", SMTP_PASS: "p" }, { f: vercel, team: "team_1" })).ok);
  const c = calls[0];
  ok("…to the right project, upserting, with the team", c.url === "https://api.vercel.com/v10/projects/github-community-blr/env?upsert=true&teamId=team_1" && c.auth === "Bearer tok");
  ok("…passwords encrypted, public values plain, on production and preview", c.body[0].type === "plain" && c.body[1].type === "encrypted" && c.body[1].target.join() === "production,preview");
  ok("a missing project is explained", /no project/.test(((await pushVercel("t", "nope", {}, { f: (async () => res(404)) as Fetch })) as { error: string }).error));

  if (fails) { console.log(`${fails} connect check(s) failed`); process.exit(1); }
  console.log("all connect checks passed");
})();
