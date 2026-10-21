/* Event proposals and the approval step: who may do what, and which step may follow which. Runs supabase/schema.sql in
   PGlite and calls every function as the wrong user too, because the rules live in SQL, not on the page. */
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
const [A, B, C, D, V, X] = [1, 2, 3, 4, 5, 6].map(id); // admin, second admin, core (proposer), another core member, volunteer, attendee
const create = (u: string, title = "Git workshop", days = 14) => fn(u, "create_proposal($1, 'workshop', today_ist() + $2::int, 'Seminar hall 2', 'Teach thirty first-years their first pull request.', 40, 5000)", [title, days]);
const status = async (pid: number) => (await one<{ status: string }>("select status from event_proposals where id = $1", [pid])).status;
const audit = async (action: string) => (await one<{ n: number }>("select count(*)::int n from crm_audit where action = $1", [action])).n;
const items = async (pid: number) => (await db.query<{ id: number; required: boolean; state: string }>("select id, required, state from proposal_checklist_items where proposal_id = $1 order by sort", [pid])).rows;
const closeRequired = async (u: string, pid: number) => { for (const i of (await items(pid)).filter((x) => x.required)) await fn(u, "set_checklist_item($1, 'done')", [i.id]); };

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
  await db.exec(SQL);
  for (const [u, h] of [[A, "ada"], [B, "bea"], [C, "cy"], [D, "dan"], [V, "vi"], [X, "xan"]] as const) {
    await db.query("insert into auth.users values ($1, $2, $3)", [u, `${h}@gitam.in`, JSON.stringify({ user_name: h })]);
    await as(u); await db.query("select register_profile('Person')");
  }
  await as("");
  for (const [u, r] of [[A, "admin"], [B, "admin"], [C, "core"], [D, "core"], [V, "volunteer"]] as const) await db.query("insert into appointments (user_id, role, ends_on) values ($1, $2, today_ist() + 100)", [u, r]);

  // ---- proposing ----
  ok("a volunteer and an attendee can't propose an event", (await create(V))?.ok === false && (await create(X))?.ok === false);
  ok("a date in the past is refused", (await create(C, "Old news", -1))?.ok === false);
  ok("a one-word title, a tiny goal or a negative budget are refused", (await fn(C, "create_proposal('Hi', 'workshop', today_ist() + 5, 'Hall', 'Teach them git properly', 40, 0)"))?.ok === false
    && (await fn(C, "create_proposal('Git day', 'workshop', today_ist() + 5, 'Hall', 'short', 40, 0)"))?.ok === false && (await fn(C, "create_proposal('Git day', 'workshop', today_ist() + 5, 'Hall', 'Teach them git properly', 40, -5)"))?.ok === false);
  const p1 = Number((await create(C))?.id);
  ok("a core member creates a draft, with the standard checklist (8 items, 5 required)", p1 > 0 && (await status(p1)) === "draft" && (await items(p1)).length === 8 && (await items(p1)).filter((i) => i.required).length === 5);
  ok("the budget is optional", (await fn(C, "create_proposal('Open mic', 'meetup', today_ist() + 9, 'Cafe', 'A relaxed evening of lightning talks.', null, null)"))?.ok === true);
  ok("nobody writes proposals or checklists directly", !!(await api(A, "insert into event_proposals (title, proposed_date, venue, objective) values ('Hack', today_ist(), 'x', 'xxxxxxxxxxxx')")).error
    && !!(await api(C, "update event_proposals set status = 'approved'")).error && !!(await api(C, "update proposal_checklist_items set state = 'done'")).error && !!(await api(C, "delete from event_proposals")).error);

  // ---- who reads ----
  ok("core and admins read proposals and their checklists; volunteers and attendees don't", (await api(D, "select * from event_proposals")).rows.length === 2 && (await api(A, "select * from proposal_checklist_items")).rows.length === 16
    && (await api(V, "select * from event_proposals")).rows.length === 0 && (await api(X, "select * from proposal_checklist_items")).rows.length === 0);
  ok("the public key reads nothing", (await api("", "select * from event_proposals", [], "anon")).rows.length === 0);

  // ---- editing ----
  const upd = (u: string, pid: number, title = "Git workshop, second edition") => fn(u, "update_proposal($1, $2, 'workshop', today_ist() + 20, 'Seminar hall 3', 'Teach thirty first-years their first pull request.', 50, 6000)", [pid, title]);
  ok("only the proposer edits their draft: not another core member, not even an admin", (await upd(D, p1))?.ok === false && (await upd(A, p1))?.ok === false && (await upd(C, p1))?.ok === true
    && (await one<{ venue: string }>("select venue from event_proposals where id = $1", [p1])).venue === "Seminar hall 3");

  // ---- the checklist ----
  const its = await items(p1); const req = its.filter((i) => i.required);
  ok("another core member can't tick the checklist; the proposer and an admin can", (await fn(D, "set_checklist_item($1, 'done')", [req[0].id]))?.ok === false && (await fn(C, "set_checklist_item($1, 'done')", [req[0].id]))?.ok === true);
  ok("'not needed' needs a reason", (await fn(C, "set_checklist_item($1, 'na')", [req[1].id]))?.ok === false && (await fn(C, "set_checklist_item($1, 'na', 'This is on campus, no permission is needed')", [req[1].id]))?.ok === true);
  ok("an unknown state is refused", (await fn(C, "set_checklist_item($1, 'finished')", [req[2].id]))?.ok === false);

  // ---- submitting and deciding ----
  ok("only the proposer submits", (await fn(D, "submit_proposal($1)", [p1]))?.ok === false && (await fn(A, "submit_proposal($1)", [p1]))?.ok === false && (await fn(C, "submit_proposal($1)", [p1]))?.ok === true && (await status(p1)) === "submitted");
  ok("a submitted proposal can't be edited or submitted again", (await upd(C, p1))?.ok === false && (await fn(C, "submit_proposal($1)", [p1]))?.ok === false);
  ok("only an admin decides: not the proposer, not a core member", (await fn(C, "decide_proposal($1, 'approved')", [p1]))?.ok === false && (await fn(D, "decide_proposal($1, 'approved')", [p1]))?.ok === false && (await fn(V, "decide_proposal($1, 'approved')", [p1]))?.ok === false);
  ok("approval is refused while required checklist items are still open, and says how many", /3 required checklist items are still open/.test((await fn(A, "decide_proposal($1, 'approved')", [p1]))?.error ?? "") && (await status(p1)) === "submitted");
  await closeRequired(A, p1);
  ok("an admin can tick items too; with every required item done or not needed, approval works (optional items may stay open)", (await items(p1)).filter((i) => !i.required).every((i) => i.state === "open") && (await fn(A, "decide_proposal($1, 'approved', 'Go ahead')", [p1]))?.ok === true && (await status(p1)) === "approved");
  ok("the decision records who and when", (await one<{ ok: boolean }>("select (decided_by = $2 and decided_at is not null and decision_note = 'Go ahead') ok from event_proposals where id = $1", [p1, A])).ok);
  ok("an approved proposal can't be decided again", (await fn(B, "decide_proposal($1, 'rejected', 'changed my mind')", [p1]))?.ok === false);

  // an admin's own proposal needs a different admin
  const own = Number((await create(A, "Admin's own idea"))?.id);
  await closeRequired(A, own); await fn(A, "submit_proposal($1)", [own]);
  ok("an admin can't approve, return or reject their own proposal", (await fn(A, "decide_proposal($1, 'approved')", [own]))?.ok === false && /own proposal/.test((await fn(A, "decide_proposal($1, 'rejected', 'no')", [own]))?.error ?? ""));
  ok("a second admin can", (await fn(B, "decide_proposal($1, 'approved')", [own]))?.ok === true);

  // return, edit, resubmit, reject
  const p2 = Number((await create(C, "Hackathon night", 30))?.id);
  await fn(C, "submit_proposal($1)", [p2]);
  ok("returning or rejecting needs a reason", (await fn(A, "decide_proposal($1, 'returned')", [p2]))?.ok === false && (await fn(A, "decide_proposal($1, 'rejected', ' ')", [p2]))?.ok === false && (await fn(A, "decide_proposal($1, 'maybe')", [p2]))?.ok === false);
  ok("an admin returns it with a reason; the proposer can then edit and resubmit", (await fn(A, "decide_proposal($1, 'returned', 'Pick a hall with a projector')", [p2]))?.ok === true && (await status(p2)) === "returned"
    && (await upd(C, p2, "Hackathon night, one projector"))?.ok === true && (await fn(C, "submit_proposal($1)", [p2]))?.ok === true && (await status(p2)) === "submitted");
  ok("an admin rejects it with a reason; a rejected proposal is closed", (await fn(B, "decide_proposal($1, 'rejected', 'Clashes with exams')", [p2]))?.ok === true && (await status(p2)) === "rejected"
    && (await fn(C, "submit_proposal($1)", [p2]))?.ok === false && (await fn(C, "cancel_proposal($1)", [p2]))?.ok === false && (await fn(C, "set_checklist_item($1, 'done')", [(await items(p2))[5].id]))?.ok === false);

  // ---- cancelling ----
  const p3 = Number((await create(C, "Quiz night", 40))?.id);
  ok("another core member can't cancel it; the proposer can, from draft", (await fn(D, "cancel_proposal($1)", [p3]))?.ok === false && (await fn(C, "cancel_proposal($1, 'Moved to next term')", [p3]))?.ok === true && (await status(p3)) === "cancelled");
  ok("a cancelled proposal can't come back", (await fn(C, "submit_proposal($1)", [p3]))?.ok === false && (await fn(A, "cancel_proposal($1)", [p3]))?.ok === false);
  ok("an admin can cancel an approved event", await (async () => { const p = Number((await create(C, "Spring fest", 60))?.id); await closeRequired(C, p); await fn(C, "submit_proposal($1)", [p]); await fn(A, "decide_proposal($1, 'approved')", [p]); return (await fn(A, "cancel_proposal($1, 'Venue lost')", [p]))?.ok === true && (await status(p)) === "cancelled"; })());

  // ---- linking the public page, then completing ----
  ok("the public page can be linked once approved: a plain address only", (await fn(C, "link_proposal_event($1, 'Not A Slug!')", [p1]))?.ok === false && (await fn(D, "link_proposal_event($1, 'git-workshop')", [p1]))?.ok === false && (await fn(C, "link_proposal_event($1, 'git-workshop')", [p1]))?.ok === true
    && (await fn(C, "link_proposal_event($1, 'x')", [p3]))?.ok === false);
  ok("completing needs an approved event, an outcome of a sentence or more", (await fn(D, "complete_proposal($1, 'It went really well and thirty people came.', null, 'No list kept')", [p1]))?.ok === false && (await fn(C, "complete_proposal($1, 'Great', null, 'We did not keep a list at all')", [p1]))?.ok === false
    && (await fn(C, "complete_proposal($1, 'It went really well and thirty people came.', null, 'x')", [p1]))?.ok === false);
  ok("…and either linked attendance that exists or a reason for none", (await fn(C, "complete_proposal($1, 'It went really well and thirty people came.', '2026-10-12', '')", [p1]))?.ok === false);
  await db.query("insert into attendance (event, name, email) values ('2026-10-12', 'Pia Nair', 'pia@x.in')");
  ok("with attendance recorded for that event it completes", (await fn(C, "complete_proposal($1, 'It went really well and thirty people came.', '2026-10-12', '')", [p1]))?.ok === true && (await status(p1)) === "completed"
    && (await one<{ ok: boolean }>("select (attendance_event = '2026-10-12' and outcome_note like 'It went%') ok from event_proposals where id = $1", [p1])).ok);
  ok("a completed proposal is final", (await fn(A, "cancel_proposal($1)", [p1]))?.ok === false && (await fn(C, "complete_proposal($1, 'Trying to complete it again, it should refuse.', null, 'no list kept at all')", [p1]))?.ok === false);
  ok("completing without attendance works with an honest reason", await (async () => { const o = Number((await create(C, "Mentor chat", 21))?.id); await closeRequired(C, o); await fn(C, "submit_proposal($1)", [o]); await fn(A, "decide_proposal($1, 'approved')", [o]);
    return (await fn(C, "complete_proposal($1, 'A small chat with two mentors about careers.', null, 'It was a closed session, so no list was kept')", [o]))?.ok === true; })());

  // ---- the audit trail ----
  ok("every step was logged", (await audit("proposal_created")) >= 6 && (await audit("proposal_submitted")) >= 5 && (await audit("proposal_approved")) >= 4 && (await audit("proposal_returned")) === 1 && (await audit("proposal_rejected")) === 1
    && (await audit("proposal_cancelled")) === 2 && (await audit("proposal_completed")) === 2 && (await audit("checklist_changed")) >= 10 && (await audit("proposal_linked")) === 1);
  ok("the log has ids and states only: no titles, venues or notes", (await one<{ n: number }>("select count(*)::int n from crm_audit where entity = 'proposal' and detail::text ~* '(workshop|hall|projector|clash|permission)'")).n === 0);
  ok("refused attempts leave no rows", (await one<{ n: number }>("select count(*)::int n from crm_audit where actor in ($1, $2)", [V, X])).n === 0);

  console.log(fails ? `\n${fails} FAILED` : "\nall proposal checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
