/* The official documents' details: an event proposal's (days, time, mode, audience, description, outcomes,
   requirements) and a meeting's (times, mode, venue, chair, recorder), and the roster the minutes print (who came, who
   didn't, with their titles on the day). Runs supabase/schema.sql in PGlite, as the right and the wrong people. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

import { AUTH_USERS } from "./auth-stub";
const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
type Res = { ok: boolean; error?: string; id?: number };
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const fn = async (uid: string, call: string, p: unknown[] = []) => { const x = await api<{ r: Res }>(uid, `select ${call} r`, p); if (x.error) console.log("  (sql error in", call, "):", x.error); return x.rows[0]?.r; };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [A, B, C, D, V, X, E] = [1, 2, 3, 4, 5, 6, 7].map(id); // admin (President), admin, core (Secretary), core (Tech lead), volunteer, attendee, core whose term ended
const details = async (table: string, rid: number) => (await one<{ d: Record<string, unknown> }>(`select details d from ${table} where id = $1`, [rid])).d;
const audit = async (action: string) => (await one<{ n: number }>("select count(*)::int n from crm_audit where action = $1", [action])).n;
const setP = (u: string, pid: number, d: object) => fn(u, "set_proposal_details($1, $2::jsonb)", [pid, JSON.stringify(d)]);
const setM = (u: string, mid: number, d: object) => fn(u, "set_meeting_details($1, $2::jsonb)", [mid, JSON.stringify(d)]);
type Person = { id: string; name: string; title: string | null };

(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    ${AUTH_USERS}
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  await db.exec(SQL);
  await db.exec("grant usage on schema public to anon, authenticated, service_role; grant select, insert, update, delete on all tables in schema public to anon, authenticated;");
  await db.exec(SQL); // the schema runs twice without trouble
  for (const [u, h, name] of [[A, "ada", "Ada Lovelace"], [B, "bea", "Bea"], [C, "cy", "Cy"], [D, "dan", "Dan"], [V, "vi", "Vi"], [X, "xan", "Xan"], [E, "eve", "Eve"]] as const) {
    await db.query("insert into auth.users values ($1, $2, $3)", [u, `${h}@gitam.in`, JSON.stringify({ user_name: h })]);
    await as(u); await db.query("select register_profile($1)", [name]);
  }
  await as("");
  for (const [u, r, t] of [[A, "admin", "President"], [B, "admin", null], [C, "core", "Secretary"], [D, "core", "Tech lead"], [V, "volunteer", null]] as const)
    await db.query("insert into appointments (user_id, role, title, starts_on, ends_on) values ($1, $2, $3, today_ist() - 30, today_ist() + 100)", [u, r, t]);
  await db.query("insert into appointments (user_id, role, title, starts_on, ends_on) values ($1, 'core', 'Old lead', today_ist() - 60, today_ist() - 1)", [E]);

  // ---- an event proposal's document ----
  const pid = Number((await fn(C, "create_proposal('Game dev intro', 'workshop', today_ist() + 20, 'SB301', 'Show students how games are made, start to finish.', 200, null)"))?.id);
  const full = { days: 1, date_tbd: true, time: "  10 AM to 1 PM ", mode: "offline", audience: "Students into games", description: "Engines, design and a live build.", outcomes: "Game basics: from idea to release\nEngines: Unity and Unreal", requirements: "Projector\nSpeakers", ignored: undefined };
  ok("the proposer fills in the document's details", (await setP(C, pid, full))?.ok === true);
  const d = await details("event_proposals", pid);
  ok("…trimmed, and kept as given", d.time === "10 AM to 1 PM" && d.days === 1 && d.date_tbd === true && d.mode === "offline" && String(d.outcomes).split("\n").length === 2);
  ok("empty answers are dropped, not stored as blanks", (await setP(C, pid, { ...full, audience: "   " }))?.ok === true && !("audience" in (await details("event_proposals", pid))));
  ok("another core member can't change someone's proposal; an admin can", (await setP(D, pid, full))?.ok === false && (await setP(A, pid, full))?.ok === true);
  ok("volunteers and the public can't", (await setP(V, pid, full))?.ok === false && !!(await api("", "select set_proposal_details(1, '{}'::jsonb)", [], "anon")).error);
  ok("days are a whole number from 1 to 30", (await setP(C, pid, { days: 0 }))?.ok === false && (await setP(C, pid, { days: 31 }))?.ok === false && (await setP(C, pid, { days: 1.5 }))?.ok === false && (await setP(C, pid, { days: "2" }))?.ok === false);
  ok("mode is offline, online or hybrid", (await setP(C, pid, { mode: "remote" }))?.ok === false && (await setP(C, pid, { mode: "hybrid" }))?.ok === true);
  const long = await setP(C, pid, { description: "x".repeat(3001) });
  ok("too long is refused, naming the field", long?.ok === false && (long?.error ?? "").startsWith("Event description takes up to 3000"));
  ok("unknown fields and wrong types are refused", (await setP(C, pid, { budget: "lots" }))?.ok === false && (await setP(C, pid, { time: 10 }))?.ok === false && (await setP(C, pid, { date_tbd: "yes" }))?.ok === false);
  ok("each change is logged", (await audit("proposal_details")) === 4);
  ok("nobody writes the details directly", !!(await api(C, "update event_proposals set details = '{}'::jsonb")).error);
  await fn(C, "cancel_proposal($1, 'No room this term')", [pid]);
  ok("a closed proposal's document can't change", (await setP(C, pid, full))?.ok === false);

  // ---- a meeting's document ----
  const mid = Number((await fn(C, "create_meeting('Core weekly', today_ist(), 'core', 'Slides review\nStage plan')"))?.id);
  await fn(C, "set_attendees($1, array['ada','cy','vi'])", [mid]);
  ok("the meeting's creator sets times, mode, venue, chair and recorder", (await setM(C, mid, { starts: "16:00", ends: "17:30", mode: "offline", venue: "SB301", chair: A, recorder: C }))?.ok === true);
  const md = await details("meetings", mid);
  ok("…and they are kept", md.starts === "16:00" && md.ends === "17:30" && md.chair === A && md.recorder === C && md.venue === "SB301");
  ok("times look like 16:00, and a meeting can't end before it starts", (await setM(C, mid, { starts: "4 PM" }))?.ok === false && (await setM(C, mid, { starts: "17:30", ends: "16:00" }))?.ok === false && (await setM(C, mid, { ends: "24:00" }))?.ok === false);
  ok("the chair and recorder must be real people", (await setM(C, mid, { chair: "someone" }))?.ok === false && (await setM(C, mid, { recorder: id(99) }))?.ok === false);
  ok("unknown fields are refused", (await setM(C, mid, { weather: "sunny" }))?.ok === false && (await setM(C, mid, { mode: "in person" }))?.ok === false);
  ok("another core member can't edit it; an admin can", (await setM(D, mid, { venue: "Hall" }))?.ok === false && (await setM(A, mid, { starts: "16:00", ends: "17:30", mode: "offline", venue: "SB301", chair: A, recorder: C }))?.ok === true);

  // ---- the roster on the minutes ----
  const roster = (await api<{ r: { present: Person[]; absent: Person[] } }>(D, "select meeting_roster($1) r", [mid])).rows[0]?.r;
  const names = (xs: Person[] | undefined) => (xs ?? []).map((p) => p.name).join(",");
  ok("present: who attended, admins first, each with their title on the day", names(roster?.present) === "Ada Lovelace,Cy,Vi" && roster?.present[0].title === "President" && roster?.present[1].title === "Secretary");
  ok("absent: organisers on the team that day who didn't come, with their titles", names(roster?.absent) === "Bea,Dan" && roster?.absent[1].title === "Tech lead");
  ok("…not volunteers, nor people whose term had already ended", !names(roster?.absent).includes("Vi") && !names(roster?.absent).includes("Eve"));
  ok("volunteers, attendees and the public can't read the roster", (await api<{ r: unknown }>(V, "select meeting_roster($1) r", [mid])).rows[0]?.r === null
    && (await api<{ r: unknown }>(X, "select meeting_roster($1) r", [mid])).rows[0]?.r === null && !!(await api("", "select meeting_roster(1)", [], "anon")).error);

  await fn(C, "update_meeting($1, 'Core weekly', 'Slides review', 'We reviewed the slides and planned the stage.')", [mid]);
  await fn(C, "finalise_minutes($1)", [mid]);
  ok("once the minutes are final, their details can't change", (await setM(C, mid, { venue: "Elsewhere" }))?.ok === false && (await details("meetings", mid)).venue === "SB301");
  ok("meeting changes are logged", (await audit("meeting_details")) === 2);

  console.log(fails ? `\n${fails} FAILED` : "\nall official document checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
