/* The newsletter list: people who came to an event are on it next to the people who joined, with one unsubscribe for
   everyone. Runs supabase/schema.sql in PGlite. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

import { AUTH_USERS } from "./auth-stub";
const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
type Row = { name: string | null; email: string; source: string | null; unsubscribed: boolean };
const row = async (email: string) => (await db.query<Row>("select name, email, source, unsubscribed from join_requests where lower(email) = lower($1)", [email])).rows[0];
const count = async () => (await db.query<{ n: number }>("select count(*)::int n from join_requests")).rows[0].n;
const checkIn = (name: string, email: string, event = "2026-10-12") => db.query("insert into attendance (event, name, email) values ($1, $2, $3)", [event, name, email]);
const join = async (name: string, email: string) => {
  await db.exec("set role service_role");
  try { return (await db.query<{ r: string }>("select join_club($1, $2) r", [name, email])).rows[0].r; } finally { await db.exec("reset role"); }
};

(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    ${AUTH_USERS}
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create publication supabase_realtime;
  `);
  await db.exec(SQL);
  await db.exec("grant usage on schema public to anon, authenticated, service_role;");

  // people checked in before this update: the re-run of schema.sql puts them on the list
  await db.exec("alter table attendance disable trigger attendance_joins_list");
  await checkIn("Ada Lovelace", "ada@gitam.in");
  await checkIn("Ada Lovelace", "ada@gitam.in", "2026-11-03"); // came twice
  await db.query("insert into join_requests (name, email, unsubscribed) values ('Grace', 'grace@gitam.in', true)");
  await checkIn("Grace Hopper", "grace@gitam.in");
  await db.exec("alter table attendance enable trigger attendance_joins_list");
  await db.exec(SQL);
  ok("re-running the schema adds everyone already checked in, once each", (await row("ada@gitam.in"))?.source === "attended" && (await count()) === 2);
  ok("someone who unsubscribed stays unsubscribed, and keeps how they joined", (await row("grace@gitam.in")).unsubscribed === true && (await row("grace@gitam.in")).source === null);
  const before = await count(); await db.exec(SQL);
  ok("a second re-run adds nobody twice", (await count()) === before);

  // from now on, a check-in adds them straight away
  await checkIn("Alan Turing", "alan@gitam.in");
  ok("a new check-in puts them on the list, marked as having come to an event", (await row("alan@gitam.in"))?.source === "attended" && (await row("alan@gitam.in")).name === "Alan Turing");
  await checkIn("Grace Hopper", "grace@gitam.in", "2026-11-03");
  ok("checking in again doesn't resubscribe anyone", (await row("grace@gitam.in")).unsubscribed === true);
  let saved = true; try { await checkIn("No Address", "not-an-email"); } catch { saved = false; }
  ok("an address the list can't hold is skipped, and the check-in still saves", saved && !(await row("not-an-email")));

  // joining yourself after coming to an event
  ok("someone on the list from an event who then joins counts as new, so they get the welcome", (await join("Alan T", "Alan@gitam.in")) === "created" && (await row("alan@gitam.in")).source === null);
  ok("joining twice is still 'exists'", (await join("Alan T", "alan@gitam.in")) === "exists");
  ok("a joined name isn't overwritten by a later form", (await row("alan@gitam.in")).name === "Alan Turing");

  // a big event's check-in list mustn't make the join form say 'busy'
  await db.exec("alter table attendance disable trigger attendance_joins_list");
  await db.query("insert into join_requests (name, email, source) select 'Guest ' || g, 'guest' || g || '@gitam.in', 'attended' from generate_series(1, 320) g");
  await db.exec("alter table attendance enable trigger attendance_joins_list");
  ok("hundreds of check-ins in an hour don't count towards the join form's limit", (await join("New Person", "new@gitam.in")) === "created");

  // one unsubscribe covers them
  await db.query("select unsubscribe_join('ada@gitam.in')");
  ok("the email's unsubscribe link works for someone added from an event", (await row("ada@gitam.in")).unsubscribed === true);

  if (fails) { console.log(`${fails} newsletter list check(s) failed`); process.exit(1); }
  console.log("all newsletter list checks passed");
})();
