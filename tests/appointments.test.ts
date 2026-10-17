/* Appointments: access that starts and ends by date, read live from the database. Runs supabase/schema.sql in PGlite
   and calls the functions as the wrong user too, because the rules live in SQL and the page only hides buttons. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
type Res = { ok: boolean; error?: string; pending?: boolean };
/** Runs SQL the way Supabase's API would: as the `authenticated` database role, signed in as `uid` ("" = nobody). */
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" | "service_role" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const grant = async (uid: string, handle: string, role: string, days: number | null, title: string | null = null) =>
  (await api<{ r: Res }>(uid, "select grant_appointment($1, $2, $3, case when $4::int is null then null else today_ist() + $4::int end) r", [handle, role, title, days])).rows[0]?.r;
const end = async (uid: string, id: number | string, why = "") => (await api<{ r: Res }>(uid, "select end_appointment($1, $2) r", [id, why])).rows[0]?.r;
const roleOf = async (uid: string) => (await api<{ r: string }>(uid, "select my_role() r")).rows[0]?.r;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [A, B, C, V, X, P] = [1, 2, 3, 4, 5, 6].map(id); // admin, second admin, core, volunteer, attendee, signs up later
const audit = async (action: string) => (await one<{ n: number }>("select count(*)::int n from crm_audit where action = $1", [action])).n;

(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  await db.exec(SQL);
  await db.exec("grant usage on schema public to anon, authenticated, service_role; grant select, insert, update, delete on all tables in schema public to anon, authenticated;");
  await db.exec(SQL); // Supabase's default grants, then the schema again: what it takes away must stay taken away
  for (const [u, h] of [[A, "ada"], [B, "bea"], [C, "cy"], [V, "vi"], [X, "xan"], [P, "pat"]] as const) await db.query("insert into auth.users values ($1, $2, $3)", [u, `${h}@gitam.in`, JSON.stringify({ user_name: h })]);
  for (const u of [A, B, C, V, X]) { await as(u); await db.query("select register_profile('Person')"); }
  await as("");

  // ---- India's date, not UTC's ----
  const d = async (ts: string) => (await one<{ d: string }>("select today_ist($1::timestamptz)::text d", [ts])).d;
  ok("18:29 UTC is still the same day in India", (await d("2026-10-17 18:29:00+00")) === "2026-10-17");
  ok("18:31 UTC is already the next day in India", (await d("2026-10-17 18:31:00+00")) === "2026-10-18");
  ok("today_ist() is the India date right now (not Postgres' UTC date)", (await one<{ ok: boolean }>("select today_ist() = (now() at time zone 'Asia/Kolkata')::date ok")).ok);

  // ---- the first admin ----
  ok("a signed-in person with no appointment is an attendee; a stranger has no role", (await roleOf(X)) === "attendee" && (await roleOf(id(99))) === "none" && (await roleOf("")) === "none");
  ok("the first admin can't come from the browser (no admin yet, and bootstrap is for the SQL editor)", !!(await api(X, "select bootstrap_admin('xan', today_ist() + 30)")).error && (await roleOf(X)) === "attendee");
  await as(""); // the SQL editor is nobody in particular: auth.uid() is null there
  ok("bootstrap_admin refuses a missing, past or far-future end date", (await one<{ r: Res }>("select bootstrap_admin('ada', today_ist() - 1) r")).r.ok === false
    && (await one<{ r: Res }>("select bootstrap_admin('ada', today_ist() + 1200) r")).r.ok === false
    && (await one<{ r: Res }>("select bootstrap_admin('ada', null) r")).r.ok === false);
  ok("…and a handle that has never signed in", (await one<{ r: Res }>("select bootstrap_admin('ghost', today_ist() + 30) r")).r.error?.includes("signed in") === true);
  ok("run from the SQL editor, it makes the first admin", (await one<{ r: Res }>("select bootstrap_admin('ada', today_ist() + 90) r")).r.ok === true && (await roleOf(A)) === "admin");
  ok("…and the display copy follows (profiles.role)", (await one<{ role: string }>("select role from profiles where id = $1", [A])).role === "admin");

  // ---- granting ----
  ok("an attendee can't grant access", (await grant(X, "vi", "volunteer", 30))?.ok === false && (await roleOf(V)) === "attendee");
  ok("a stranger with no profile can't either", (await grant(id(99), "vi", "volunteer", 30))?.ok === false);
  ok("the public key can't call it at all", !!(await api("", "select grant_appointment('vi', 'volunteer', null, today_ist() + 30)", [], "anon")).error);
  ok("an admin appoints a volunteer (any @ and letter case) and it shows at once", (await grant(A, "@VI", "volunteer", 30, "Registration desk"))?.ok === true && (await roleOf(V)) === "volunteer");
  ok("a made-up role, no end date, a past date, a 3-year-plus date and a long title are all refused",
    (await grant(A, "xan", "owner", 30))?.ok === false && (await grant(A, "xan", "core", null))?.ok === false && (await grant(A, "xan", "core", -1))?.ok === false
    && (await grant(A, "xan", "core", 1200))?.ok === false && (await grant(A, "xan", "core", 30, "x".repeat(61)))?.ok === false && (await roleOf(X)) === "attendee");
  ok("a nonsense handle is refused", (await grant(A, "not a handle!", "core", 30))?.ok === false);
  ok("an admin can't change their own access", /own access/.test((await grant(A, "ada", "volunteer", 30))?.error ?? "") && (await roleOf(A)) === "admin");
  ok("the core role is real: Cy becomes core", (await grant(A, "cy", "core", 60, "Events lead"))?.ok === true && (await roleOf(C)) === "core");
  ok("a second admin is appointed", (await grant(A, "bea", "admin", 60, "Vice President"))?.ok === true && (await roleOf(B)) === "admin");

  // ---- what each role can reach ----
  await db.query("insert into join_requests (handle, email, first_event) values ('new', 'new@x.in', '2026-10-07')");
  const reads = async (u: string) => (await api<{ handle: string }>(u, "select handle from join_requests")).rows.length;
  ok("sign-ups are read by volunteer, core and admin but not by an attendee", (await reads(V)) === 1 && (await reads(C)) === 1 && (await reads(A)) === 1 && (await reads(X)) === 0);
  ok("a core member can check people in at the desk, like a volunteer", (await api<{ r: { ok: boolean } }>(C, "select issue_ticket($1, 398) r", [X])).rows[0]?.r.ok === true);
  ok("…but can't award coins or change roles (admins only)", (await api<{ r: { ok: boolean } }>(C, "select award_coins($1, 50, 'x') r", [X])).rows[0]?.r.ok === false && (await grant(C, "xan", "volunteer", 30))?.ok === false);
  ok("a volunteer can't grant or end anything", (await grant(V, "xan", "volunteer", 30))?.ok === false);

  // ---- replacing, ending ----
  const ids = async (u: string) => (await db.query<{ id: number }>("select id from appointments where user_id = $1 and revoked_at is null order by id", [u])).rows.map((r) => Number(r.id));
  ok("a new appointment ends the old one: the volunteer is promoted to core and holds just one", (await grant(A, "vi", "core", 45))?.ok === true && (await roleOf(V)) === "core" && (await ids(V)).length === 1);
  ok("the old row is kept, marked ended", (await one<{ n: number }>("select count(*)::int n from appointments where user_id = $1 and revoked_at is not null and revoke_reason like 'replaced%'", [V])).n === 1);
  ok("a non-admin can't end an appointment", (await end(X, (await ids(V))[0]))?.ok === false && (await end(C, (await ids(V))[0]))?.ok === false && (await roleOf(V)) === "core");
  ok("an admin can't end their own", /own access/.test((await end(A, (await ids(A))[0]))?.error ?? "") && (await roleOf(A)) === "admin");
  ok("an admin ends someone else's early, with a reason; access stops at once", (await end(A, (await ids(V))[0], "left the club"))?.ok === true && (await roleOf(V)) === "attendee");
  ok("ending it twice is refused", (await end(A, (await ids(V)).at(0) ?? 0))?.ok === false);
  ok("ending an appointment takes a volunteer off their booth", await (async () => {
    await grant(A, "vi", "volunteer", 30); await db.query("update profiles set booth = 'vr' where id = $1", [V]);
    await end(A, (await ids(V))[0]); return (await one<{ booth: string | null }>("select booth from profiles where id = $1", [V])).booth === null;
  })());
  ok("an admin appointed by mistake can be ended by the other admin, and then the first is the only one left",
    (await end(B, (await ids(A))[0]))?.ok === true && (await roleOf(A)) === "attendee" && (await roleOf(B)) === "admin");
  ok("…who can't end themselves, so the last active admin always stays", (await end(B, (await ids(B))[0]))?.ok === false && (await roleOf(B)) === "admin");
  await as(""); await db.query("select bootstrap_admin('ada', today_ist() + 90)"); // put the first admin back
  ok("…and the first admin is back", (await roleOf(A)) === "admin");

  // ---- access ends by itself ----
  await grant(A, "xan", "core", 5);
  ok("the appointment is active today", (await roleOf(X)) === "core");
  await db.query("update appointments set ends_on = today_ist() where user_id = $1 and revoked_at is null", [X]);
  ok("on its last day it still works (the end date is included)", (await roleOf(X)) === "core");
  await db.query("update appointments set starts_on = today_ist() - 5, ends_on = today_ist() - 1 where user_id = $1 and revoked_at is null", [X]);
  ok("the day after, the same open session has no organiser access (read live, not remembered)", (await roleOf(X)) === "attendee" && (await reads(X)) === 0);
  ok("…and the Epoch functions refuse too", (await api<{ r: { ok: boolean } }>(X, "select issue_ticket($1, 398) r", [C])).rows[0]?.r.ok === false);
  // time passing changes no row, so the display copy can lag; the weekly sync catches it up (simulated by switching the trigger off for one edit)
  await db.exec("alter table appointments disable trigger appointment_changed");
  await db.query("update appointments set ends_on = today_ist() - 2, starts_on = today_ist() - 9 where user_id = $1", [X]);
  await db.exec("alter table appointments enable trigger appointment_changed");
  await db.exec("alter table profiles disable trigger profile_role_mirror");
  await db.query("update profiles set role = 'core' where id = $1", [X]); // what the copy said while the appointment was running
  await db.exec("alter table profiles enable trigger profile_role_mirror");
  ok("…the weekly sync brings the display copy up to date", (await api<{ r: number }>("", "select sync_profile_roles() r", [], "service_role")).rows[0]?.r >= 1
    && (await one<{ role: string }>("select role from profiles where id = $1", [X])).role === "attendee");
  await db.query("update appointments set starts_on = today_ist() + 1, ends_on = today_ist() + 10 where user_id = $1", [X]);
  ok("an appointment that starts tomorrow gives nothing yet", (await roleOf(X)) === "attendee");
  await db.query("update appointments set starts_on = today_ist() - 3, ends_on = today_ist() + 10, revoked_at = now() where user_id = $1", [X]);
  ok("a revoked appointment gives nothing", (await roleOf(X)) === "attendee");
  await db.query("delete from appointments where user_id = $1", [X]);

  // ---- before the first sign-in ----
  ok("a handle that hasn't signed in is remembered, with its end date", (await grant(A, "PAT", "volunteer", 20, "Volunteer"))?.pending === true
    && (await one<{ n: number }>("select count(*)::int n from pending_roles where handle = 'pat'")).n === 1);
  await as(P); await db.query("select register_profile('Pat')");
  ok("…and becomes an appointment the first time they sign in", (await roleOf(P)) === "volunteer"
    && (await one<{ n: number }>("select count(*)::int n from appointments where user_id = $1 and ends_on = today_ist() + 20", [P])).n === 1
    && (await one<{ n: number }>("select count(*)::int n from pending_roles where handle = 'pat'")).n === 0);
  await db.query("insert into auth.users values ($1, 'old@gitam.in', '{\"user_name\":\"olduser\"}')", [id(7)]);
  await db.query("insert into pending_roles (handle, role) values ('olduser', 'admin')"); // made before appointments existed: no end date
  await as(id(7)); await db.query("select register_profile('Old')");
  ok("a grant from before appointments (no end date) does not make anyone an admin by itself", (await roleOf(id(7))) === "attendee" && (await one<{ n: number }>("select count(*)::int n from pending_roles where handle = 'olduser'")).n === 1);

  // ---- who is who ----
  const people = async (u: string) => (await api<{ handle: string; role: string; ends_on: string | null; title: string | null; appointment_id: number | null }>(u, "select * from list_people()")).rows;
  const adaView = (await people(A)).find((r) => r.handle === "cy"), cyView = (await people(C)).find((r) => r.handle === "cy");
  ok("an admin sees each person's live role, title and end date", adaView?.role === "core" && adaView.title === "Events lead" && !!adaView.ends_on && adaView.appointment_id !== null);
  ok("a core member sees names and roles but not end dates or ids", cyView?.role === "core" && cyView.ends_on === null && cyView.appointment_id === null && cyView.title === null);
  ok("an attendee sees nobody", (await people(X)).length === 0);
  ok("an attendee reads only their own appointments; an admin reads all", (await api(C, "select * from appointments")).rows.length === 1 && (await api(X, "select * from appointments")).rows.length === 0 && (await api(A, "select * from appointments")).rows.length > 3);
  ok("nobody writes appointments directly, not even an admin", !!(await api(A, "insert into appointments (user_id, role, ends_on) values ($1, 'admin', today_ist() + 9)", [X])).error
    && !!(await api(A, "update appointments set ends_on = today_ist() + 999")).error && !!(await api(A, "delete from appointments")).error);

  // ---- warnings for the Monday digest ----
  const warn = (await api<{ r: { active_admins: number; ending: { handle: string; days_left: number }[] } }>("", "select appointment_warnings() r", [], "service_role")).rows[0].r;
  ok("the digest is told how many admins are active (two here)", warn.active_admins === 2);
  ok("…and a 20-day appointment is not in the 14-day warning yet", !warn.ending.some((e) => e.handle === "pat"));
  await grant(A, "pat", "volunteer", 9);
  const warn2 = (await api<{ r: { ending: { handle: string; days_left: number }[] } }>("", "select appointment_warnings() r", [], "service_role")).rows[0].r;
  ok("a 9-day appointment shows with 9 days left", warn2.ending.some((e) => e.handle === "pat" && e.days_left === 9));
  ok("the public key and signed-in users can't read the warnings", !!(await api("", "select appointment_warnings()", [], "anon")).error && !!(await api(A, "select appointment_warnings()")).error);

  // ---- the audit trail ----
  ok("every grant, end and first-sign-in appointment was logged", (await audit("appointment_granted")) >= 6 && (await audit("appointment_ended")) >= 3 && (await audit("appointment_pending")) === 1);
  ok("the log holds ids and dates, no names or emails", (await one<{ n: number }>("select count(*)::int n from crm_audit where detail::text ~* '(gitam|@)'")).n === 0);
  ok("refused attempts leave no rows", (await one<{ n: number }>("select count(*)::int n from crm_audit where actor = $1", [X])).n === 0);
  ok("only admins read the log", (await api(A, "select * from crm_audit")).rows.length > 5 && (await api(C, "select * from crm_audit")).rows.length === 0 && (await api(X, "select * from crm_audit")).rows.length === 0);
  ok("nobody can write it directly", !!(await api(A, "insert into crm_audit (action, entity) values ('x', 'y')")).error && !!(await api(A, "select crm_log('x', 'y', null)")).error);
  ok("nobody can change or delete a row, not even as the database owner", !!(await api(A, "update crm_audit set action = 'x'")).error && !!(await api(A, "delete from crm_audit")).error
    && await db.query("update crm_audit set action = 'x'").then(() => false, () => true) && await db.query("delete from crm_audit").then(() => false, () => true));

  // ---- profiles.role never decides access ----
  const bodies = (await db.query<{ n: string; def: string }>("select proname n, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.prokind = 'f'")).rows;
  const policies = (await db.query<{ n: string; q: string }>("select policyname n, coalesce(qual, '') || ' ' || coalesce(with_check, '') q from pg_policies where schemaname = 'public'")).rows;
  const readsRole = (t: string) => /\b(me|t|p|profiles|u)\.role\b/.test(t) || /select\s+role\s+from\s+profiles/i.test(t) || /profiles[^;]{0,80}\brole\s*(=|in|<>|!=)/i.test(t.replace(/set role = role[^;]*/gi, ""));
  const offenders = [...bodies.filter((b) => !["profile_role_mirror", "sync_profile_roles", "appointment_changed"].includes(b.n) && readsRole(b.def)).map((b) => `function ${b.n}`), ...policies.filter((q) => readsRole(q.q)).map((q) => `policy ${q.n}`)];
  ok(`no function or policy reads profiles.role to decide access${offenders.length ? ": " + offenders.join(", ") : ""} (${bodies.length} functions, ${policies.length} policies checked)`, offenders.length === 0);
  await db.query("update profiles set role = 'admin' where id = $1", [X]);
  ok("setting profiles.role by hand gives nothing: the mirror resets it and access is unchanged", (await roleOf(X)) === "attendee" && (await one<{ role: string }>("select role from profiles where id = $1", [X])).role === "attendee"
    && (await api<{ r: Res }>(X, "select grant_appointment('xan', 'admin', null, today_ist() + 5) r")).rows[0]?.r.ok === false);

  // ---- the one-off backfill for people who had a role before appointments existed ----
  const D = id(8), E = id(9);
  await db.query("insert into auth.users values ($1, 'dee@gitam.in', '{\"user_name\":\"dee\"}'), ($2, 'eli@gitam.in', '{\"user_name\":\"eli\"}')", [D, E]);
  await as(D); await db.query("select register_profile('Dee')"); await as(E); await db.query("select register_profile('Eli')"); await as("");
  await db.exec("alter table profiles disable trigger profile_role_mirror");
  await db.query("update profiles set role = 'volunteer' where id = $1", [D]); await db.query("update profiles set role = 'admin' where id = $1", [E]); // how they looked before the update
  await db.exec("alter table profiles enable trigger profile_role_mirror");
  const backfill = fs.readFileSync("supabase/backfill-appointments.sql", "utf8");
  ok("the backfill refuses to run with the placeholder date", await db.exec(backfill).then(() => false, (e) => /real end date/.test((e as Error).message)) && (await roleOf(D)) === "attendee");
  const until = (await one<{ d: string }>("select (today_ist() + 200)::text d")).d;
  const withDate = backfill.replace("'2099-01-01', false", `'${until}', false`);
  await db.exec(withDate);
  ok("with a date, people who had a role get it as an appointment until that date", (await roleOf(D)) === "volunteer" && (await roleOf(E)) === "admin"
    && (await one<{ n: number }>("select count(*)::int n from appointments where user_id in ($1, $2) and ends_on = $3::date", [D, E, until])).n === 2);
  ok("…and it is logged, but people who already had appointments are left alone", (await one<{ n: number }>("select count(*)::int n from crm_audit where detail->>'via' = 'backfill'")).n === 2
    && (await one<{ n: number }>("select count(*)::int n from appointments where user_id = $1", [A])).n === 2);
  await db.exec(withDate);
  ok("running it again adds nothing", (await one<{ n: number }>("select count(*)::int n from appointments where user_id in ($1, $2)", [D, E])).n === 2);

  console.log(fails ? `\n${fails} FAILED` : "\nall appointment checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
