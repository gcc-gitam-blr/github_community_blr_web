/* Tasks, meetings, minutes and the decisions register: who may do what, what can never change afterwards. Runs
   supabase/schema.sql in PGlite and calls every function as the wrong user too, because the rules live in SQL. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
type Res = { ok: boolean; error?: string; id?: number; count?: number };
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" | "service_role" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const fn = async (uid: string, call: string, p: unknown[] = []) => { const x = await api<{ r: Res }>(uid, `select ${call} r`, p); if (x.error) console.log("  (sql error in", call, "):", x.error); return x.rows[0]?.r; };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [A, B, C, D, V, X] = [1, 2, 3, 4, 5, 6].map(id); // admin, second admin, core (creator), another core member, volunteer, attendee
const task = (u: string, owner: string, due = 5, title = "Book the seminar hall") => fn(u, "create_task($1, 'Confirm with the front desk', $2, today_ist() + $3::int)", [title, owner, due]);
const taskStatus = async (t: number) => (await one<{ status: string }>("select status from tasks where id = $1", [t])).status;
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
  await db.exec(SQL);
  for (const [u, h] of [[A, "ada"], [B, "bea"], [C, "cy"], [D, "dan"], [V, "vi"], [X, "xan"]] as const) {
    await db.query("insert into auth.users values ($1, $2, $3)", [u, `${h}@gitam.in`, JSON.stringify({ user_name: h })]);
    await as(u); await db.query("select register_profile('Person')");
  }
  await as("");
  for (const [u, r] of [[A, "admin"], [B, "admin"], [C, "core"], [D, "core"], [V, "volunteer"]] as const) await db.query("insert into appointments (user_id, role, ends_on) values ($1, $2, today_ist() + 100)", [u, r]);

  // ---- creating tasks ----
  ok("only the core team and admins create tasks", (await task(V, "cy"))?.ok === false && (await task(X, "cy"))?.ok === false);
  ok("a task needs a real owner with core or admin access: not a volunteer, an attendee or a stranger", (await task(C, "vi"))?.ok === false && (await task(C, "xan"))?.ok === false && (await task(C, "nobody"))?.ok === false);
  ok("…and a due date that is today or later", (await task(C, "dan", -1))?.ok === false && (await fn(C, "create_task('No date', null, 'dan', null)"))?.ok === false);
  ok("a tiny title is refused", (await task(C, "dan", 5, "Hi"))?.ok === false);
  const t1 = Number((await task(C, "@DAN"))?.id);
  ok("a core member creates a task for a colleague (handle in any case) with owner, creator and due date set", t1 > 0 && (await one<{ ok: boolean }>("select (owner_id = $2 and creator_id = $3 and due_on = today_ist() + 5 and status = 'todo') ok from tasks where id = $1", [t1, D, C])).ok);
  ok("nobody writes tasks directly", !!(await api(C, "insert into tasks (title, owner_id, creator_id, due_on) values ('Hack', $1, $1, today_ist())", [C])).error && !!(await api(A, "update tasks set status = 'done'")).error && !!(await api(A, "delete from tasks")).error);
  ok("core and admins read all tasks; volunteers and attendees none", (await api(C, "select * from tasks")).rows.length === 1 && (await api(A, "select * from tasks")).rows.length === 1 && (await api(V, "select * from tasks")).rows.length === 0 && (await api(X, "select * from tasks")).rows.length === 0);

  // ---- changing status ----
  ok("the owner, the creator and an admin can move a task; another core member can't, nor a volunteer", (await fn(V, "set_task_status($1, 'done')", [t1]))?.ok === false
    && await (async () => { const t = Number((await task(C, "cy", 3, "Order stickers"))?.id); const other = await fn(D, "set_task_status($1, 'doing')", [t]); const mine = await fn(C, "set_task_status($1, 'doing')", [t]); return other?.ok === false && mine?.ok === true; })());
  ok("the owner marks it doing, then done: completion time is set, and reopening clears it", (await fn(D, "set_task_status($1, 'doing')", [t1]))?.ok === true && (await fn(D, "set_task_status($1, 'done')", [t1]))?.ok === true
    && (await one<{ c: boolean }>("select completed_at is not null c from tasks where id = $1", [t1])).c && (await fn(C, "set_task_status($1, 'todo')", [t1]))?.ok === true && !(await one<{ c: boolean }>("select completed_at is not null c from tasks where id = $1", [t1])).c);
  ok("an admin can move anyone's task; a made-up status is refused", (await fn(A, "set_task_status($1, 'blocked')", [t1]))?.ok === true && (await fn(A, "set_task_status($1, 'finished')", [t1]))?.ok === false && (await taskStatus(t1)) === "blocked");

  // ---- reassigning and dates ----
  ok("only the creator or an admin reassigns or moves the date: not the owner", (await fn(D, "reassign_task($1, 'cy', null)", [t1]))?.ok === false && (await fn(D, "reassign_task($1, null, today_ist() + 20)", [t1]))?.ok === false);
  ok("the creator reassigns to someone with access, and changes the date", (await fn(C, "reassign_task($1, 'bea', today_ist() + 9)", [t1]))?.ok === true && (await one<{ ok: boolean }>("select (owner_id = $2 and due_on = today_ist() + 9) ok from tasks where id = $1", [t1, B])).ok);
  ok("…but not to a volunteer, and not to a past date", (await fn(C, "reassign_task($1, 'vi', null)", [t1]))?.ok === false && (await fn(C, "reassign_task($1, null, today_ist() - 1)", [t1]))?.ok === false);

  // ---- overdue, and owners who lose access ----
  const t2 = Number((await task(C, "dan", 1, "Print the posters"))?.id);
  await db.query("update tasks set due_on = today_ist() - 3 where id = $1", [t2]);
  await db.query("update appointments set ends_on = today_ist() - 1, starts_on = today_ist() - 9 where user_id = $1", [D]); // Dan's term ended
  const w = (await api<{ r: { overdue: { id: number; days: number }[]; orphaned: { id: number; owner: string }[] } }>("", "select task_warnings() r", [], "service_role")).rows[0].r;
  ok("an open task past its date is overdue, with how many days", w.overdue.some((o) => o.id === t2 && o.days === 3));
  ok("an open task whose owner has lost access needs reassigning", w.orphaned.some((o) => o.id === t2 && o.owner === "dan"));
  ok("finished tasks never show up", await (async () => { await fn(C, "set_task_status($1, 'done')", [t2]); const r = (await api<{ r: { overdue: { id: number }[]; orphaned: { id: number }[] } }>("", "select task_warnings() r", [], "service_role")).rows[0].r; return !r.overdue.some((o) => o.id === t2) && !r.orphaned.some((o) => o.id === t2); })());
  ok("the warnings are for the server only", !!(await api(A, "select task_warnings()")).error && !!(await api("", "select task_warnings()", [], "anon")).error);
  await db.query("update appointments set ends_on = today_ist() + 100, starts_on = today_ist() where user_id = $1", [D]);

  // ---- meetings ----
  const mtg = (u: string, title = "Core team sync", kind = "core") => fn(u, "create_meeting($1, today_ist() - 1, $2, 'Budget, Epoch dates')", [title, kind]);
  ok("only the core team and admins create meetings", (await mtg(V))?.ok === false && (await mtg(X))?.ok === false && (await mtg(C, "Hi"))?.ok === false && (await mtg(C, "Core team sync", "party"))?.ok === false);
  const m1 = Number((await mtg(C))?.id);
  ok("a meeting is created with its creator", m1 > 0 && (await one<{ c: string }>("select created_by c from meetings where id = $1", [m1])).c === C);
  ok("core and admins read meetings; volunteers and attendees don't", (await api(D, "select * from meetings")).rows.length === 1 && (await api(V, "select * from meetings")).rows.length === 0 && (await api(X, "select * from meetings")).rows.length === 0);
  ok("only the creator or an admin edits the minutes and says who attended: not another core member", (await fn(D, "update_meeting($1, 'Core team sync', 'Budget', 'We agreed the budget.')", [m1]))?.ok === false && (await fn(D, "set_attendees($1, ARRAY['cy'])", [m1]))?.ok === false
    && (await fn(C, "update_meeting($1, 'Core team sync', 'Budget, Epoch dates', 'We agreed the Epoch budget and the December dates.')", [m1]))?.ok === true && (await fn(A, "set_attendees($1, ARRAY['@cy','Dan','nobody-here'])", [m1]))?.count === 2);
  ok("the minutes can't be finalised empty or by someone else", (await fn(D, "finalise_minutes($1)", [m1]))?.ok === false && await (async () => { const e = Number((await mtg(C, "Empty one"))?.id); return (await fn(C, "finalise_minutes($1)", [e]))?.ok === false; })());

  // ---- action items and decisions at the meeting ----
  const act = await fn(C, "create_task('Send the budget to the faculty', null, 'cy', today_ist() + 4, null, $1)", [m1]);
  ok("an action item is a task that points at its meeting", act?.ok === true && (await one<{ m: string }>("select meeting_id::text m from tasks where id = $1", [act!.id])).m === String(m1));
  ok("a task can't point at a meeting that doesn't exist", (await fn(C, "create_task('Ghost item', null, 'cy', today_ist() + 4, null, 99999)"))?.ok === false);
  const dec = (u: string, meeting: number | null = m1, on = "today_ist()") => fn(u, `record_decision($1, 'Epoch budget', 'The budget is capped at the amount agreed with the faculty.', 'Keeps us inside what was approved', ${on})`, [meeting]);
  ok("the creator records decisions made at their meeting; another core member can't; a volunteer can't", (await dec(D))?.ok === false && (await dec(V))?.ok === false && (await dec(C))?.ok === true);
  ok("a decision with no meeting is for admins only", (await dec(C, null))?.ok === false && (await dec(A, null))?.ok === true);
  ok("a decision can't be dated in the future, or have an empty body", (await dec(A, m1, "today_ist() + 1"))?.ok === false && (await fn(A, "record_decision($1, 'Hi', 'x', null, today_ist())", [m1]))?.ok === false);
  const first = (await one<{ id: number }>("select id from decisions where meeting_id = $1 order by id limit 1", [m1])).id;
  ok("core and admins read decisions; volunteers and attendees don't", (await api(D, "select * from decisions")).rows.length === 2 && (await api(V, "select * from decisions")).rows.length === 0);

  // ---- decisions are only added ----
  ok("nobody updates or deletes a decision: not through the API, and not even as the database owner", !!(await api(A, "update decisions set decision = 'x'")).error && !!(await api(A, "delete from decisions")).error
    && await db.query("update decisions set decision = 'rewritten'").then(() => false, () => true) && await db.query("delete from decisions").then(() => false, () => true));
  ok("only an admin supersedes a decision", (await fn(C, "supersede_decision($1, 'Epoch budget v2', 'A new cap was agreed.', null)", [first]))?.ok === false && (await fn(D, "supersede_decision($1, 'x y z', 'A new cap was agreed.', null)", [first]))?.ok === false);
  const sup = await fn(A, "supersede_decision($1, 'Epoch budget, revised', 'The cap is raised after the sponsor confirmed more.', 'Sponsor confirmed')", [first]);
  ok("superseding adds a new decision linked to the old one, and marks the old as superseded; both stay", sup?.ok === true
    && (await one<{ ok: boolean }>("select (o.status = 'superseded' and n.status = 'active' and n.supersedes_id = o.id and o.decision like 'The budget is capped%' and n.meeting_id = o.meeting_id) ok from decisions o, decisions n where o.id = $1 and n.id = $2", [first, sup!.id])).ok);
  ok("a superseded decision can't be superseded again, and the old words are untouched", (await fn(A, "supersede_decision($1, 'Again', 'Trying to replace it again.', null)", [first]))?.ok === false
    && (await one<{ d: string }>("select decision d from decisions where id = $1", [first])).d.startsWith("The budget is capped"));
  ok("a decision has only one successor", await db.query("insert into decisions (title, decision, decided_on, supersedes_id, recorded_by) values ('Dup', 'Another successor', current_date, $1, $2)", [first, A]).then(() => false, () => true));

  // ---- minutes become final ----
  ok("finalising makes the minutes read-only", (await fn(C, "finalise_minutes($1)", [m1]))?.ok === true && (await fn(C, "update_meeting($1, 'Core team sync', 'x', 'Changed!')", [m1]))?.ok === false && (await fn(A, "set_attendees($1, ARRAY['cy'])", [m1]))?.ok === false
    && (await fn(C, "finalise_minutes($1)", [m1]))?.ok === false);
  ok("…even for the database owner", await db.query("update meetings set minutes = 'rewritten' where id = $1", [m1]).then(() => false, () => true) && await db.query("update meetings set held_on = current_date - 5 where id = $1", [m1]).then(() => false, () => true) && await db.query("delete from meetings where id = $1", [m1]).then(() => false, () => true));
  ok("a correction is a new note beside the minutes: core and admins can add one, nobody can edit or delete it", (await fn(D, "add_minutes_note($1, 'The December dates are provisional until the university confirms.')", [m1]))?.ok === true
    && (await fn(V, "add_minutes_note($1, 'I was there too.')", [m1]))?.ok === false && (await fn(D, "add_minutes_note($1, 'x')", [m1]))?.ok === false
    && !!(await api(D, "update meeting_notes set note = 'x'")).error && !!(await api(A, "delete from meeting_notes")).error);
  ok("a note needs final minutes", await (async () => { const f = Number((await mtg(C, "Still open"))?.id); return (await fn(C, "add_minutes_note($1, 'This should be refused.')", [f]))?.ok === false; })());
  ok("core and admins read the attendees and notes; others don't", (await api(D, "select * from meeting_attendees")).rows.length === 2 && (await api(D, "select * from meeting_notes")).rows.length === 1 && (await api(V, "select * from meeting_notes")).rows.length === 0 && (await api(X, "select * from meeting_attendees")).rows.length === 0);

  // ---- the audit trail ----
  ok("every step was logged", (await audit("task_created")) >= 4 && (await audit("task_status")) >= 6 && (await audit("task_reassigned")) === 1 && (await audit("meeting_created")) >= 3 && (await audit("meeting_updated")) === 1
    && (await audit("attendees_set")) === 1 && (await audit("minutes_finalised")) === 1 && (await audit("minutes_note")) === 1 && (await audit("decision_recorded")) === 2 && (await audit("decision_superseded")) === 1);
  ok("the log has ids and states only: no titles, agendas, minutes or notes", (await one<{ n: number }>("select count(*)::int n from crm_audit where entity in ('task','meeting','decision') and detail::text ~* '(budget|seminar|sticker|poster|epoch|faculty|dates)'")).n === 0);
  ok("refused attempts leave no rows", (await one<{ n: number }>("select count(*)::int n from crm_audit where actor in ($1, $2)", [V, X])).n === 0);

  console.log(fails ? `\n${fails} FAILED` : "\nall task and meeting checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
