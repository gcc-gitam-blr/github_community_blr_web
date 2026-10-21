/* Database security: the public forms can only be written by the server, every SECURITY DEFINER function pins its
   search_path, and nothing is executable by the public key unless it is meant to be. Runs supabase/schema.sql in PGlite. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

import { AUTH_USERS } from "./auth-stub";
const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
const asRole = async <T,>(role: "anon" | "authenticated" | "service_role", sql: string, p: unknown[] = []) => {
  await as(""); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const svc = (sql: string, p: unknown[] = []) => asRole<{ r: string }>("service_role", sql, p);
const EVENT = "2026-10-07";

/* Who may run each SECURITY DEFINER function. Anything new has to be added here on purpose: a function that
   isn't listed, or that a role can run when it shouldn't, fails this test. */
const SERVER = ["service_role"], SIGNED_IN = ["authenticated"], ANYONE = ["anon", "authenticated"], NOBODY: string[] = [];
const EXPECTED: Record<string, string[]> = {
  // Epoch: the coin and organiser functions check my_role() inside; visitors who aren't signed in can't call them
  register_profile: SIGNED_IN, issue_ticket: SIGNED_IN, award_coins: SIGNED_IN, scan_booth: SIGNED_IN, redeem_reward: SIGNED_IN,
  staff_scan: SIGNED_IN, reverse_tx: SIGNED_IN, find_attendees: SIGNED_IN, staff_txs: SIGNED_IN, my_attendance: SIGNED_IN,
  set_role: SIGNED_IN, assign_booth: SIGNED_IN,
  // appointments: each checks my_role() = 'admin' (or organiser, for list_people) itself
  grant_appointment: SIGNED_IN, end_appointment: SIGNED_IN, list_people: SIGNED_IN,
  role_of: NOBODY, github_login: NOBODY, crm_log: NOBODY, profile_role_mirror: NOBODY, appointment_changed: NOBODY, // internal: other functions and triggers only
  // members and recruitment: each checks my_role() and the record's state itself; applying goes through the server
  create_campaign: SIGNED_IN, set_campaign_dates: SIGNED_IN, set_campaign_status: SIGNED_IN, add_reviewer: SIGNED_IN, remove_reviewer: SIGNED_IN,
  review_application: SIGNED_IN, move_application: SIGNED_IN, decide_application: SIGNED_IN, onboard_application: SIGNED_IN,
  create_member: SIGNED_IN, update_member: SIGNED_IN, set_member_status: SIGNED_IN, import_members: SIGNED_IN, export_members: SIGNED_IN, export_signups: SIGNED_IN,
  is_own_application: NOBODY, can_see_application: NOBODY, open_campaign: SERVER, submit_application: SERVER,
  set_campaign_form: SIGNED_IN, export_applications: SIGNED_IN, log_recruitment_email: SIGNED_IN, // admins only, checked inside
  // event proposals: each checks the proposer or admin itself
  create_proposal: SIGNED_IN, update_proposal: SIGNED_IN, submit_proposal: SIGNED_IN, decide_proposal: SIGNED_IN, cancel_proposal: SIGNED_IN,
  complete_proposal: SIGNED_IN, set_checklist_item: SIGNED_IN, link_proposal_event: SIGNED_IN, can_edit_proposal: NOBODY,
  // the official documents: each checks the proposer / the meeting's creator / admin, or the core team, itself
  set_proposal_details: SIGNED_IN, set_meeting_details: SIGNED_IN, meeting_roster: SIGNED_IN,
  // tasks, meetings and decisions: each checks the owner, creator or admin itself
  create_task: SIGNED_IN, set_task_status: SIGNED_IN, reassign_task: SIGNED_IN, create_meeting: SIGNED_IN, update_meeting: SIGNED_IN, set_attendees: SIGNED_IN,
  finalise_minutes: SIGNED_IN, add_minutes_note: SIGNED_IN, record_decision: SIGNED_IN, supersede_decision: SIGNED_IN, can_own_tasks: NOBODY, task_warnings: SERVER,
  // assets and handover: admin-only writes, checked inside; asset_warnings answers only to the core team and admins
  save_asset: SIGNED_IN, set_asset_notes: SIGNED_IN, asset_warnings: SIGNED_IN, start_handover: SIGNED_IN, set_handover_item: SIGNED_IN, complete_handover: SIGNED_IN,
  asset_problems: NOBODY, asset_problems_for_digest: SERVER,
  // policies: admin-only, checked inside; the digest's list is for the server key
  create_policy: SIGNED_IN, set_policy_owner: SIGNED_IN, save_policy_draft: SIGNED_IN, discard_policy_draft: SIGNED_IN, publish_policy_version: SIGNED_IN, policy_reviews_due: SERVER,
  // project hub: members and the core team; each function checks can_take_part() / the owner / the role itself. public_projects is for the site's server.
  can_take_part: SIGNED_IN, save_interests: SIGNED_IN, delete_interests: SIGNED_IN, survey_summary: SIGNED_IN, find_teammates: SIGNED_IN, post_idea: SIGNED_IN, update_idea: SIGNED_IN,
  set_idea_status: SIGNED_IN, request_to_join: SIGNED_IN, withdraw_request: SIGNED_IN, decide_request: SIGNED_IN, leave_project: SIGNED_IN, remove_project_member: SIGNED_IN,
  set_project_owner: SIGNED_IN, set_public_credit: SIGNED_IN, request_publishing: SIGNED_IN, decide_publishing: SIGNED_IN, unpublish_project: SIGNED_IN, public_projects: SERVER,
  my_board_status: SIGNED_IN, set_board_opt_in: SIGNED_IN, board_members: SERVER, // the board opt-in
  sync_profile_roles: SERVER, appointment_warnings: SERVER, admin_emails: SERVER, bootstrap_admin: SERVER, // the weekly digest, and the first admin from the SQL editor
  booth_tx: NOBODY, log_action: NOBODY, bump_leaderboard: NOBODY, // internal: other functions and triggers only
  my_role: ANYONE, // used by row-level-security policies, so every role must be able to run it; it only ever answers about the caller
  // public by design: a certificate is verified by its unguessable id; browser error reports are capped at 2000 a day
  certificate: ANYONE, log_client_error: ANYONE,
  // server only: the site checks the honeypot, fill time and rate limit first
  submit_join: SERVER, join_club: SERVER, finish_join: SERVER, submit_message: SERVER, submit_feedback: SERVER, epoch_interest_join: SERVER, unsubscribe_join: SERVER, rate_hit: SERVER, prune_old_data: SERVER,
};

(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    ${AUTH_USERS}
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  await db.exec(SQL);
  // Supabase hands the API roles every table and function by default, so what the schema takes away is what counts.
  await db.exec("grant usage on schema public to anon, authenticated, service_role; grant select, insert, update, delete on all tables in schema public to anon, authenticated;");
  await db.exec(SQL); // …and re-running the file must take away the same things

  // ---- search_path ----
  const defs = SQL.match(/create or replace function[\s\S]*?(?=\ncreate |\n--|$)/g) ?? [];
  const header = (d: string) => d.slice(0, d.indexOf("$")); // everything before the body: name, language, security, search_path
  const bad = defs.filter((d) => /security definer/.test(header(d)) && !/set search_path = public, pg_temp/.test(header(d))).map((d) => d.match(/function (\w+)/)![1]);
  ok(`every SECURITY DEFINER function in schema.sql pins search_path (${defs.filter((d) => /security definer/.test(header(d))).length} checked)`, bad.length === 0 && defs.length > 20);
  const unpinned = (await db.query<{ proname: string }>("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and prosecdef and not coalesce(proconfig::text, '') like '%search_path=public, pg_temp%'")).rows;
  ok("…and the database agrees (no function runs with the caller's search_path)", unpinned.length === 0);

  // ---- who can run what ----
  const funcs = (await db.query<{ proname: string; anon: boolean; authenticated: boolean; service_role: boolean; pub: boolean }>(`
    select proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') authenticated,
           has_function_privilege('service_role', p.oid, 'execute') service_role,
           coalesce((select bool_or(a.grantee = 0) from aclexplode(p.proacl) a where a.privilege_type = 'EXECUTE'), true) pub
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and prosecdef order by proname`)).rows;
  const unlisted = funcs.filter((f) => !(f.proname in EXPECTED)).map((f) => f.proname);
  ok(`every SECURITY DEFINER function is listed in this test (${funcs.length} found)${unlisted.length ? ": add " + unlisted.join(", ") : ""}`, unlisted.length === 0);
  ok("none is left executable by PUBLIC (the Postgres default) unless it is listed for everyone", funcs.filter((f) => f.pub && EXPECTED[f.proname]?.join() !== ANYONE.join()).length === 0);
  for (const f of funcs.filter((x) => x.proname in EXPECTED)) {
    const want = EXPECTED[f.proname].filter((r) => r !== "service_role"), have = (["anon", "authenticated"] as const).filter((r) => f[r]);
    ok(`${f.proname}: runnable by ${want.join(" + ") || "no browser role"}`, want.join() === have.join());
  }
  for (const f of funcs.filter((x) => EXPECTED[x.proname] === SERVER)) ok(`${f.proname}: the server key can run it`, f.service_role);

  // ---- the public forms ----
  const VALID = ["ada", "Ada@Gitam.in", EVENT];
  for (const role of ["anon", "authenticated"] as const) {
    ok(`${role} can't insert a sign-up straight into the table`, !!(await asRole(role, "insert into join_requests (handle, email, first_event) values ('bot', 'bot@x.in', $1)", [EVENT])).error);
    ok(`${role} can't insert a message straight into the table`, !!(await asRole(role, "insert into messages (kind, name, email, message) values ('question', 'Bot', 'bot@x.in', 'a spammy message here')")).error);
    ok(`${role} can't insert feedback straight into the table`, !!(await asRole(role, "insert into event_feedback (event, rating) values ($1, 5)", [EVENT])).error);
    ok(`${role} can't call the form functions with the public key`, !!(await asRole(role, "select submit_join($1, $2, $3)", VALID)).error
      && !!(await asRole(role, "select submit_message('question', 'Bot', 'bot@x.in', null, 'a spammy message here')")).error
      && !!(await asRole(role, "select submit_feedback($1, 5, null, null)", [EVENT])).error);
  }
  ok("nothing got in through any of those", (await one<{ n: number }>("select (select count(*) from join_requests) + (select count(*) from messages) + (select count(*) from event_feedback) as n")).n === 0);

  ok("the server saves a sign-up (trimmed, lower-case email)", (await svc("select submit_join(' ada ', ' Ada@Gitam.in ', $1) r", [EVENT])).rows[0]?.r === "created"
    && (await one<{ handle: string; email: string }>("select handle, email from join_requests")).email === "ada@gitam.in");
  ok("the same email again (any letter case) says 'exists' and adds nothing", (await svc("select submit_join('ada2', 'ADA@gitam.in', $1) r", [EVENT])).rows[0]?.r === "exists"
    && (await one<{ n: number }>("select count(*)::int n from join_requests")).n === 1);
  ok("a bad handle, bad email or over-long event is refused by the table's own checks", !!(await svc("select submit_join('-no-', 'a@b.in', $1)", [EVENT])).error
    && !!(await svc("select submit_join('bob', 'nope', $1)", [EVENT])).error && !!(await svc("select submit_join('bob', 'b@b.in', $1)", ["x".repeat(21)])).error);

  const msg = (kind: string, handle: string | null = null, text = "I would like to help run events.") => asRole<{ r: string }>("service_role", "select submit_message($1, ' Ada ', ' Ada@Gitam.in ', $2, $3) r", [kind, handle, text]);
  ok("the server saves a message", (await msg("apply", "ada")).rows[0]?.r === "created");
  ok("…an empty handle is stored as null, the email lower-case", (await msg("question", "  ")).rows[0]?.r === "created"
    && (await db.query<{ handle: string | null; email: string; name: string }>("select handle, email, name from messages order by id desc limit 1")).rows[0].handle === null);
  ok("an unknown kind or a one-word message is refused", !!(await msg("spam")).error && !!(await msg("question", null, "hi")).error);

  const fb = (rating: number, liked: string | null = "Great mentors") => asRole<{ r: string }>("service_role", "select submit_feedback($1, $2, $3, '  ') r", [EVENT, rating, liked]);
  ok("the server saves feedback; a blank answer is stored as null", (await fb(5)).rows[0]?.r === "created"
    && (await one<{ improve: string | null }>("select improve from event_feedback")).improve === null);
  ok("a rating of 6 is refused", !!(await fb(6)).error);

  // the hourly backstop: a runaway script can't fill the tables even with the server's key
  await db.query("insert into join_requests (handle, email, first_event) select 'u' || g, 'u' || g || '@x.in', $1 from generate_series(1, 300) g", [EVENT]);
  ok("after 300 sign-ups in an hour the function answers 'busy'", (await svc("select submit_join('late', 'late@x.in', $1) r", [EVENT])).rows[0]?.r === "busy");
  await db.query("insert into messages (kind, name, email, message) select 'question', 'uu', 'u@x.in', 'a long enough message' from generate_series(1, 200)");
  ok("…200 messages an hour", (await msg("question")).rows[0]?.r === "busy");
  await db.query("insert into event_feedback (event, rating) select $1, 4 from generate_series(1, 600)", [EVENT]);
  ok("…600 feedback answers an hour", (await fb(4)).rows[0]?.r === "busy");
  await db.query("update join_requests set created_at = now() - interval '2 hours'");
  ok("…and it opens up again the next hour", (await svc("select submit_join('late', 'late@x.in', $1) r", [EVENT])).rows[0]?.r === "created");

  console.log(fails ? `\n${fails} FAILED` : "\nall security checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
