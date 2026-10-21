/* The board opt-in: active members choose to appear on the public contribution board; nobody is added without asking.
   Runs supabase/schema.sql in PGlite, as the people involved. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { boardMembers } from "../lib/board";

import { AUTH_USERS } from "./auth-stub";
const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" | "service_role" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [MIA, NOA, PAT, Q] = [1, 2, 3, 4].map(id); // two active members, an inactive one, someone who isn't a member
type Status = { member: boolean; on_board: boolean; handle?: string };
const status = async (u: string) => (await api<{ r: Status }>(u, "select my_board_status() r")).rows[0].r;
const optIn = async (u: string, on: boolean) => (await api<{ r: { ok: boolean; error?: string } }>(u, "select set_board_opt_in($1) r", [on])).rows[0]?.r;
const board = async () => (await api<{ r: { name: string; handle: string }[] }>("", "select board_members() r", [], "service_role")).rows[0].r;

(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    ${AUTH_USERS}
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  await db.exec(SQL);
  await db.exec("grant usage on schema public to anon, authenticated, service_role;");
  for (const [u, h] of [[MIA, "mia"], [NOA, "noa"], [PAT, "pat"], [Q, "quin"]] as const) { await db.query("insert into auth.users values ($1, $2, $3)", [u, `${h}@gitam.in`, JSON.stringify({ user_name: h })]); await as(u); await db.query("select register_profile('Person')"); }
  await as("");
  await db.query("insert into members (name, email, handle, user_id) values ('Mia', 'mia@gitam.in', 'mia', $1)", [MIA]);
  await db.query("insert into members (name, email, user_id) values ('Noa', 'noa@gitam.in', $1)", [NOA]); // no handle on the record: their sign-in has one
  await db.query("insert into members (name, email, handle, status, user_id) values ('Pat', 'pat@gitam.in', 'pat', 'inactive', $1)", [PAT]);

  ok("nobody is on the board until they choose to be", (await board()).length === 0 && (await status(MIA)).member === true && (await status(MIA)).on_board === false);
  ok("someone who isn't an active member can't opt in, and is told so", (await optIn(Q, true))?.ok === false && (await optIn(PAT, true))?.ok === false && (await status(Q)).member === false);
  ok("an active member opts in and appears with their name and GitHub username", (await optIn(MIA, true))?.ok === true && JSON.stringify(await board()) === JSON.stringify([{ name: "Mia", handle: "mia" }]));
  ok("a member without a username on their record is found by the one they sign in with", (await optIn(NOA, true))?.ok === true && (await board()).some((b) => b.handle === "noa"));
  ok("opting out takes them off", (await optIn(MIA, false))?.ok === true && !(await board()).some((b) => b.handle === "mia"));
  await db.query("update members set status = 'inactive' where name = 'Noa'");
  ok("a member who becomes inactive drops off the board", (await board()).length === 0);
  ok("the list is for the server only; the public key can't opt anyone in", !!(await api("", "select board_members()", [], "anon")).error && !!(await api(MIA, "select board_members()")).error && !!(await api("", "select set_board_opt_in(true)", [], "anon")).error);
  ok("each change is logged without names", (await db.query<{ n: number }>("select count(*)::int n from crm_audit where action = 'board_opt_in' and detail::text !~* 'mia|noa'")).rows[0].n === 3);
  ok("the site merges opted-in members with the team list, once each", boardMembers([{ name: "Mia", handle: "mia" }, { name: "Mia again", handle: "MIA" }, { name: "Ola", handle: "ola" }]).map((m) => m.handle).join() === "mia,ola");

  console.log(fails ? `\n${fails} FAILED` : "\nall board opt-in checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
