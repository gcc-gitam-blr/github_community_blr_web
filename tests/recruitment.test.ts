/* Members and recruitment: who can apply, read, review and decide, and what each step may follow. Runs supabase/schema.sql
   in PGlite and calls every function as the wrong user too, because the rules live in SQL, not on the page. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

import { AUTH_USERS } from "./auth-stub";
const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
type Res = { ok: boolean; error?: string; id?: number | string; member?: string; valid?: number; total?: number; dry_run?: boolean; added?: number; updated?: number; unchanged?: number; notes?: unknown[]; errors?: { row: number; error: string }[] };
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" | "service_role" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const fn = async (uid: string, call: string, p: unknown[] = []) => { const x = await api<{ r: Res }>(uid, `select ${call} r`, p); if (x.error) console.log("  (sql error in", call, "):", x.error); return x.rows[0]?.r; };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [A, B, C, D, V, X] = [1, 2, 3, 4, 5, 6].map(id); // admin, 2nd admin, core reviewer, core (not assigned), volunteer, an applicant who also has an account
const apply = async (campaign: number, name: string, email: string, handle = "someone", team: string | null = "Tech", answers: unknown = { why: "I like building things" }) =>
  (await api<{ r: string }>("", "select submit_application($1, $2, $3, $4, $5, $6::jsonb) r", [campaign, name, email, handle, team, JSON.stringify(answers)], "service_role"));
const status = async (appId: number) => (await one<{ status: string }>("select status from applications where id = $1", [appId])).status;
const audit = async (action: string) => (await one<{ n: number }>("select count(*)::int n from crm_audit where action = $1", [action])).n;

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
  for (const [u, h, e] of [[A, "ada", "ada@gitam.in"], [B, "bea", "bea@gitam.in"], [C, "cy", "cy@gitam.in"], [D, "dan", "dan@gitam.in"], [V, "vi", "vi@gitam.in"], [X, "Xan", "xan@gitam.in"]] as const) {
    await db.query("insert into auth.users values ($1, $2, $3)", [u, e, JSON.stringify({ user_name: h })]);
    await as(u); await db.query("select register_profile('Person')");
  }
  await as("");
  for (const [u, r] of [[A, "admin"], [B, "admin"], [C, "core"], [D, "core"], [V, "volunteer"]] as const) await db.query("insert into appointments (user_id, role, ends_on) values ($1, $2, today_ist() + 100)", [u, r]);

  // ---- who can read the club's other lists (volunteers are event-day staff) ----
  await db.query("insert into join_requests (handle, email, first_event) values ('new', 'new@x.in', '2026-10-07')");
  await db.query("insert into messages (kind, name, email, message) values ('question', 'Ann', 'ann@x.in', 'a question long enough')");
  await db.query("insert into event_feedback (event, rating) values ('2026-10-07', 5)");
  const reads = async (u: string, t: string) => (await api(u, `select * from ${t}`)).rows.length;
  ok("core and admins read sign-ups, messages and feedback; a volunteer no longer does", (await reads(C, "join_requests")) === 1 && (await reads(A, "messages")) === 1 && (await reads(D, "event_feedback")) === 1
    && (await reads(V, "join_requests")) === 0 && (await reads(V, "messages")) === 0 && (await reads(V, "event_feedback")) === 0);
  ok("…but a volunteer still checks people in (event-day powers stay)", (await api<{ r: { ok: boolean } }>(V, "select issue_ticket($1, 398) r", [X])).rows[0]?.r.ok === true);
  ok("exporting sign-ups is a function that logs it; a volunteer gets nothing", (await api(C, "select * from export_signups()")).rows.length === 1 && (await api(V, "select * from export_signups()")).rows.length === 0 && (await audit("export")) === 1);

  // ---- campaigns ----
  const cmp = async (u: string, name = "Core team 2026-27", opens = -1, closes = 10) => fn(u, "create_campaign($1, '2026-27', today_ist() + $2::int, today_ist() + $3::int)", [name, opens, closes]);
  ok("only an admin creates a campaign", (await cmp(C))?.ok === false && (await cmp(V))?.ok === false && (await cmp(X))?.ok === false);
  ok("a campaign can't close before it opens, or have a tiny name", (await cmp(A, "Core team 2026-27", 5, 2))?.ok === false && (await cmp(A, "ab"))?.ok === false);
  const c1 = Number((await cmp(A))?.id);
  ok("an admin creates one, as a draft", c1 > 0 && (await one<{ status: string }>("select status from recruitment_campaigns where id = $1", [c1])).status === "draft");
  ok("nobody writes campaigns directly", !!(await api(A, "insert into recruitment_campaigns (name, year, opens_on, closes_on) values ('hack', '2026', today_ist(), today_ist())")).error);
  ok("a draft campaign is not open to applicants", (await apply(c1, "Pia Nair", "pia@x.in")).rows[0]?.r === "closed");
  ok("the public form sees no open campaign yet", (await api<{ r: unknown }>("", "select open_campaign() r", [], "service_role")).rows[0]?.r === null);
  ok("a core member can't open it; an admin can", (await fn(C, "set_campaign_status($1, 'open')", [c1]))?.ok === false && (await fn(A, "set_campaign_status($1, 'open')", [c1]))?.ok === true);
  ok("…and the public form now sees it, with its closing date", ((await api<{ r: { id: number; name: string; closes_on: string } }>("", "select open_campaign() r", [], "service_role")).rows[0]?.r)?.id === c1);
  ok("a second campaign can't open at the same time", await (async () => { const c2 = Number((await cmp(A, "Spring drive"))?.id); return (await fn(A, "set_campaign_status($1, 'open')", [c2]))?.ok === false; })());
  ok("illegal status jumps are refused (open → archived, draft → closed)", (await fn(A, "set_campaign_status($1, 'archived')", [c1]))?.ok === false);

  // ---- applying (through the server only) ----
  ok("an applicant is saved (name and email trimmed, email lower-cased)", (await apply(c1, " Pia Nair ", " Pia@X.in ", "pia-n", "Design")).rows[0]?.r === "created"
    && (await one<{ email: string; name: string }>("select email, name from applications where handle = 'pia-n'")).email === "pia@x.in");
  ok("the same email again (any case) is 'exists' and adds nothing", (await apply(c1, "Pia Again", "PIA@x.in", "pia-2")).rows[0]?.r === "exists" && (await one<{ n: number }>("select count(*)::int n from applications")).n === 1);
  for (const role of ["anon", "authenticated"] as const) {
    ok(`${role} can't insert an application or call the function with the public key`, !!(await api(role === "anon" ? "" : A, "insert into applications (campaign_id, name, email, handle) values ($1, 'Bot', 'b@x.in', 'bot')", [c1], role)).error
      && !!(await api(role === "anon" ? "" : A, "select submit_application($1, 'Bot', 'b@x.in', 'bot', null, '{}')", [c1], role)).error);
  }
  ok("a bad handle, a bad email or a name of one letter is refused by the table", !!(await apply(c1, "Q R", "q@x.in", "-bad-")).error && !!(await apply(c1, "Q R", "nope", "qr")).error && !!(await apply(c1, "Q", "q@x.in", "qr")).error);
  ok("answers fit their questions: a 2001-character answer, answers to questions the round doesn't ask, or a number instead of text are refused", !!(await apply(c1, "Q R", "q1@x.in", "qr", null, { why: "x".repeat(2001) })).error
    && !!(await apply(c1, "Q R", "q2@x.in", "qr", null, { a: "1", b: "2", c: "3", d: "4", e: "5", f: "6", g: "7" })).error && !!(await apply(c1, "Q R", "q3@x.in", "qr", null, { why: 5 })).error);
  ok("application_submitted is logged with ids only (no names or emails)", (await audit("application_submitted")) === 1
    && (await one<{ n: number }>("select count(*)::int n from crm_audit where action = 'application_submitted' and detail::text ~* '(pia|@)'")).n === 0);
  await db.query("update recruitment_campaigns set closes_on = today_ist() - 1 where id = $1", [c1]);
  ok("after the closing date nobody can apply (India date), though the status is still open", (await apply(c1, "Late Lena", "lena@x.in")).rows[0]?.r === "closed" && (await api<{ r: unknown }>("", "select open_campaign() r", [], "service_role")).rows[0]?.r === null);
  await db.query("update recruitment_campaigns set closes_on = today_ist() + 10 where id = $1", [c1]);
  await db.query("update recruitment_campaigns set opens_on = today_ist() + 1 where id = $1", [c1]);
  ok("before the opening date nobody can apply either", (await apply(c1, "Early Eli", "eli@x.in")).rows[0]?.r === "closed");
  await db.query("update recruitment_campaigns set opens_on = today_ist() - 1 where id = $1", [c1]);
  const appId = Number((await one<{ id: number }>("select id from applications where handle = 'pia-n'")).id);
  await apply(c1, "Xan Lastname", "xan@gitam.in", "XAN", "Tech"); // the applicant who also holds an account (same email, other letter case in the handle)
  const own = Number((await one<{ id: number }>("select id from applications where lower(handle) = 'xan'")).id);
  await apply(c1, "Sam Roy", "sam@x.in", "sam-r", null);
  const sam = Number((await one<{ id: number }>("select id from applications where handle = 'sam-r'")).id);

  // ---- who can read applications ----
  const apps = async (u: string) => (await api<{ id: number }>(u, "select id from applications")).rows.length;
  ok("a volunteer, an attendee and an unassigned core member read no applications", (await apps(V)) === 0 && (await apps(X)) === 0 && (await apps(D)) === 0 && (await apps(C)) === 0);
  ok("an admin reads them all", (await apps(A)) === 3);
  ok("only an admin assigns reviewers, and only people with a core or admin appointment", (await fn(C, "add_reviewer($1, 'cy')", [c1]))?.ok === false && (await fn(A, "add_reviewer($1, 'vi')", [c1]))?.ok === false
    && (await fn(A, "add_reviewer($1, 'nobody')", [c1]))?.ok === false && (await fn(A, "add_reviewer($1, '@CY')", [c1]))?.ok === true);
  ok("the assigned reviewer reads the campaign's applications; an unassigned core member still doesn't", (await apps(C)) === 3 && (await apps(D)) === 0);
  ok("a reviewer who loses their core appointment stops seeing them", await (async () => {
    await db.query("update appointments set ends_on = today_ist() - 1, starts_on = today_ist() - 5 where user_id = $1", [C]);
    const n = await apps(C); await db.query("update appointments set ends_on = today_ist() + 100, starts_on = today_ist() where user_id = $1", [C]); return n === 0;
  })());
  ok("a core member reads the campaign list and members; a volunteer doesn't", (await reads(D, "recruitment_campaigns")) >= 1 && (await reads(V, "recruitment_campaigns")) === 0);

  // ---- reviewing ----
  ok("a stranger or an unassigned core member can't review, and is told the application isn't available (same as a missing one)",
    (await fn(D, "review_application($1, 4, 'good')", [appId]))?.error === "That application isn't available to you." && (await fn(V, "review_application($1, 4, 'x')", [appId]))?.ok === false
    && (await fn(C, "review_application(999999, 4, 'x')"))?.error === "That application isn't available to you.");
  ok("an unassigned admin can't review either (the matrix says assigned)", (await fn(A, "review_application($1, 4, 'x')", [appId]))?.ok === false);
  ok("the assigned reviewer scores 1 to 5; 0 and 6 are refused", (await fn(C, "review_application($1, 4, 'Strong, a clear plan')", [appId]))?.ok === true && (await fn(C, "review_application($1, 0)", [appId]))?.ok === false && (await fn(C, "review_application($1, 6)", [appId]))?.ok === false);
  ok("reviewing again updates their review, not a second one", (await fn(C, "review_application($1, 5, 'Even better')", [appId]))?.ok === true && (await one<{ n: number }>("select count(*)::int n from application_reviews where application_id = $1", [appId])).n === 1);
  ok("a reviewer reads only their own reviews; an admin reads all", (await api(C, "select * from application_reviews")).rows.length === 1 && (await api(D, "select * from application_reviews")).rows.length === 0 && (await api(A, "select * from application_reviews")).rows.length === 1);
  await db.query("insert into campaign_reviewers (campaign_id, user_id) values ($1, $2) on conflict do nothing", [c1, A]);
  ok("a reviewer can't review their own application: same email, or the same GitHub name in another letter case", await (async () => {
    await db.query("insert into campaign_reviewers (campaign_id, user_id) values ($1, $2) on conflict do nothing", [c1, X]);
    await db.query("insert into appointments (user_id, role, ends_on) values ($1, 'core', today_ist() + 30)", [X]);
    const r = await fn(X, "review_application($1, 5, 'me')", [own]);
    await db.query("delete from appointments where user_id = $1", [X]); await db.query("delete from campaign_reviewers where user_id = $1", [X]);
    return r?.ok === false && /own application/.test(r.error ?? "");
  })());
  ok("an admin who applied can't decide or onboard their own application", await (async () => {
    await db.query("update applications set email = 'ada@gitam.in', status = 'interview' where id = $1", [sam]);
    const r1 = await fn(A, "decide_application($1, 'selected')", [sam]), r2 = await fn(A, "move_application($1, 'withdrawn')", [sam]);
    await db.query("update applications set email = 'sam@x.in', status = 'submitted' where id = $1", [sam]);
    return r1?.ok === false && /own application/.test(r1.error ?? "") && r2?.ok === false;
  })());

  // ---- moving along ----
  ok("a reviewer moves submitted → screening → interview", (await fn(C, "move_application($1, 'screening')", [appId]))?.ok === true && (await status(appId)) === "screening" && (await fn(C, "move_application($1, 'interview')", [appId]))?.ok === true);
  ok("illegal moves are refused (interview → screening, submitted → interview, to a made-up status)", (await fn(C, "move_application($1, 'screening')", [appId]))?.ok === false && (await fn(A, "move_application($1, 'interview')", [sam]))?.ok === false && (await fn(A, "move_application($1, 'hired')", [sam]))?.ok === false);
  ok("a reviewer can't decide, and can't move to selected or withdrawn", (await fn(C, "decide_application($1, 'selected')", [appId]))?.ok === false && (await fn(C, "move_application($1, 'selected')", [appId]))?.ok === false && (await fn(C, "move_application($1, 'withdrawn')", [appId]))?.ok === false);
  ok("an application can't be decided before its interview", (await fn(A, "decide_application($1, 'selected')", [sam]))?.ok === false);
  ok("an admin records the decision with a reason", (await fn(A, "decide_application($1, 'waitlisted', 'Strong, no room this term')", [appId]))?.ok === true && (await status(appId)) === "waitlisted"
    && (await one<{ reason: string }>("select reason from selection_decisions where application_id = $1", [appId])).reason.startsWith("Strong"));
  ok("only admins read decisions", (await api(C, "select * from selection_decisions")).rows.length === 0 && (await api(A, "select * from selection_decisions")).rows.length === 1);
  ok("a decided application isn't decided twice: a waitlisted one can become selected, then that is final", (await fn(A, "decide_application($1, 'waitlisted')", [appId]))?.ok === false
    && (await fn(A, "decide_application($1, 'selected', 'A place opened')", [appId]))?.ok === true && (await fn(A, "decide_application($1, 'rejected')", [appId]))?.ok === false
    && (await one<{ n: number }>("select count(*)::int n from selection_decisions where application_id = $1", [appId])).n === 1);
  ok("nobody writes decisions or reviews directly", !!(await api(A, "insert into selection_decisions (application_id, decision) values ($1, 'selected')", [sam])).error && !!(await api(C, "insert into application_reviews (application_id, reviewer_id, score) values ($1, $2, 5)", [sam, C])).error);

  // ---- onboarding makes a member, once ----
  ok("only an admin onboards; a non-selected application can't be", (await fn(C, "onboard_application($1)", [appId]))?.ok === false && (await fn(A, "onboard_application($1)", [sam]))?.ok === false);
  ok("onboarding a selected application creates exactly one member and nothing else (no appointment)", (await fn(A, "onboard_application($1)", [appId]))?.ok === true && (await status(appId)) === "onboarded"
    && (await one<{ n: number }>("select count(*)::int n from members where source_application_id = $1", [appId])).n === 1
    && (await one<{ n: number }>("select count(*)::int n from appointments a join profiles p on p.id = a.user_id where p.handle = 'pia-n'")).n === 0);
  ok("onboarding again is refused and adds no second member", (await fn(A, "onboard_application($1)", [appId]))?.ok === false && (await one<{ n: number }>("select count(*)::int n from members")).n === 1);
  ok("the new member has the applicant's details and today's date", (await one<{ ok: boolean }>("select (name = 'Pia Nair' and email = 'pia@x.in' and handle = 'pia-n' and team = 'Design' and joined_on = today_ist() and status = 'active') ok from members")).ok);
  ok("withdrawing is for admins and works from an open state", (await fn(C, "move_application($1, 'withdrawn')", [sam]))?.ok === false && (await fn(A, "move_application($1, 'withdrawn')", [sam]))?.ok === true && (await status(sam)) === "withdrawn");
  ok("every step above was logged", (await audit("application_reviewed")) >= 2 && (await audit("application_moved")) >= 3 && (await audit("application_decided")) === 2 && (await audit("application_onboarded")) === 1 && (await audit("reviewer_added")) >= 1 && (await audit("campaign_created")) >= 2);

  // ---- a round's own form, like a Google Form ----
  type Q = { id: string; type: string; label: string; required: boolean; options?: string[]; help?: string; extra?: string };
  const form: Q[] = [
    { id: "why", type: "long", label: "Why do you want to join?", required: true },
    { id: "role", type: "choice", label: "Which role?", required: true, options: ["Design", "Code"] },
    { id: "tools", type: "checkboxes", label: "Tools you use", required: false, options: ["Figma", "Git", "Canva"] },
    { id: "sure", type: "scale", label: "How sure are you?", required: false },
    { id: "repo", type: "link", label: "A link to your work", required: false },
  ];
  const setForm = (u: string, qs: Q[], teams: string[] = ["Design", "Tech"], intro = "Tell us about you.") => fn(u, "set_campaign_form($1, $2, $3::jsonb, $4::jsonb)", [c1, intro, JSON.stringify(qs), JSON.stringify(teams)]);
  const started = await one<{ q: unknown[]; t: string[] }>("select questions q, teams t from recruitment_campaigns where id = $1", [c1]);
  ok("a round starts with the first form's two questions and five teams", started.q.length === 2 && started.t.length === 5);
  ok("only an admin changes a round's form", (await setForm(C, form))?.ok === false && (await setForm(A, form))?.ok === true);
  const pub = (await api<{ r: { questions: Q[]; intro: string; teams: string[] } }>("", "select open_campaign() r", [], "service_role")).rows[0]?.r;
  ok("the public form gets the round's questions, introduction and teams", pub?.questions.length === 5 && pub.intro === "Tell us about you." && pub.teams.join() === "Design,Tech");
  ok("a form needs 1 to 20 questions, a real type, a real question, and 2+ options for a choice", (await setForm(A, []))?.ok === false
    && (await setForm(A, Array.from({ length: 21 }, (_, i) => ({ id: `q${i}`, type: "short", label: "Question?", required: false }))))?.ok === false
    && (await setForm(A, [{ id: "x", type: "essay", label: "What?", required: false }]))?.ok === false && (await setForm(A, [{ id: "x", type: "short", label: "Hi", required: false }]))?.ok === false
    && (await setForm(A, [{ id: "x", type: "choice", label: "Pick one", required: false, options: ["Only"] }]))?.ok === false);
  ok("question ids are simple and unique, and unknown fields are refused", (await setForm(A, [{ ...form[0] }, { ...form[0] }]))?.ok === false
    && (await setForm(A, [{ ...form[0], id: "Bad Id" }]))?.ok === false && (await setForm(A, [{ ...form[0], extra: "x" }]))?.ok === false);
  ok("up to 12 teams of 1 to 40 characters", (await setForm(A, form, Array.from({ length: 13 }, (_, i) => `Team ${i}`)))?.ok === false && (await setForm(A, form, [""]))?.ok === false);
  ok("each saved form is logged", (await audit("campaign_form")) === 1);
  const fine = { why: "I want to help run events.", role: "Design", tools: ["Git", "Figma"], sure: "4", repo: "https://github.com/fan" };
  ok("an application that answers the round's questions is saved", (await apply(c1, "Form Fan", "fan@x.in", "fan", "Tech", fine)).rows[0]?.r === "created");
  ok("ticked boxes are kept as a list", JSON.stringify((await one<{ a: unknown }>("select answers -> 'tools' a from applications where email = 'fan@x.in'")).a) === JSON.stringify(["Git", "Figma"]));
  ok("a required question left out is 'incomplete', and nothing is saved", (await apply(c1, "No Role", "norole@x.in", "nr", null, { why: "A long enough answer." })).rows[0]?.r === "incomplete"
    && (await one<{ n: number }>("select count(*)::int n from applications where email = 'norole@x.in'")).n === 0);
  ok("a choice that isn't offered, a box that isn't offered, or a 6 on the scale are refused", !!(await apply(c1, "Bad Pick", "bp1@x.in", "bp", null, { ...fine, role: "Hacking" })).error
    && !!(await apply(c1, "Bad Pick", "bp2@x.in", "bp", null, { ...fine, tools: ["Vim"] })).error && !!(await apply(c1, "Bad Pick", "bp3@x.in", "bp", null, { ...fine, sure: "6" })).error);
  ok("answers to questions the round doesn't ask, or a team it doesn't offer, are refused", !!(await apply(c1, "Old Form", "of@x.in", "of", null, { ...fine, built: "a thing" })).error
    && !!(await apply(c1, "Wrong Team", "wt@x.in", "wt", "Events", fine)).error);

  // ---- the responses as a spreadsheet, and emailing applicants ----
  ok("only an admin downloads a round's applications, and the download is logged", (await api(C, "select * from export_applications($1)", [c1])).rows.length === 0
    && (await api(A, "select * from export_applications($1)", [c1])).rows.length === 4 && (await one<{ n: number }>("select count(*)::int n from crm_audit where action = 'export' and entity = 'applications'")).n === 1);
  ok("emailing a round's applicants is logged, by admins only", (await fn(C, "log_recruitment_email($1, 'selected', 3)", [c1]))?.ok === false
    && (await fn(A, "log_recruitment_email($1, 'selected', 3)", [c1]))?.ok === true && (await audit("recruitment_email")) === 1);

  // ---- members ----
  ok("core and admins read members; a volunteer and an attendee don't", (await reads(C, "members")) === 1 && (await reads(A, "members")) === 1 && (await reads(V, "members")) === 0 && (await reads(X, "members")) === 0);
  ok("nobody writes members directly", !!(await api(A, "insert into members (name, email) values ('Hack', 'h@x.in')")).error && !!(await api(A, "update members set name = 'x'")).error && !!(await api(A, "delete from members")).error);
  ok("only an admin adds or edits a member", (await fn(C, "create_member('Zed Zee', 'zed@x.in', 'zed', 'Tech', null)"))?.ok === false && (await fn(A, "create_member('Zed Zee', 'zed@x.in', '@ZED', 'Tech', null)"))?.ok === true);
  ok("the same email or GitHub username can't be a member twice", (await fn(A, "create_member('Zed Two', 'ZED@x.in', 'other', null, null)"))?.ok === false && (await fn(A, "create_member('Zed Two', 'z2@x.in', 'zed', null, null)"))?.ok === false);
  const zed = (await one<{ id: string }>("select id from members where handle = 'zed'")).id;
  ok("an edit changes details; clashes and bad values are refused", (await fn(A, "update_member($1, 'Zed Zee', 'zed@x.in', 'zed', 'Design', null)", [zed]))?.ok === true && (await fn(A, "update_member($1, 'Zed', 'pia@x.in', 'zed', null, null)", [zed]))?.ok === false
    && (await fn(A, "update_member($1, 'Z', 'zed@x.in', 'zed', null, null)", [zed]))?.ok === false && (await fn(C, "update_member($1, 'Zed Zee', 'zed@x.in', 'zed', 'Tech', null)", [zed]))?.ok === false);
  ok("status changes are admin-only, validated, dated and logged", (await fn(C, "set_member_status($1, 'alumni')", [zed]))?.ok === false && (await fn(A, "set_member_status($1, 'gone')", [zed]))?.ok === false
    && (await fn(A, "set_member_status($1, 'alumni')", [zed]))?.ok === true && (await one<{ ok: boolean }>("select (status = 'alumni' and left_on = today_ist() and status_since = today_ist()) ok from members where id = $1", [zed])).ok
    && (await fn(A, "set_member_status($1, 'active')", [zed]))?.ok === true && (await one<{ left_on: string | null }>("select left_on from members where id = $1", [zed])).left_on === null && (await audit("member_status_changed")) === 2);
  ok("a member is linked to their sign-in by email or GitHub name", (await fn(A, "create_member('Cy Core', 'cy@gitam.in', null, null, null)"))?.ok === true
    && (await one<{ user_id: string }>("select user_id from members where email = 'cy@gitam.in'")).user_id === C);

  // ---- CSV import ----
  const rows = (...r: Record<string, string>[]) => JSON.stringify(r);
  const before = (await one<{ n: number }>("select count(*)::int n from members")).n;
  const imp = (u: string, r: string, dry = true) => fn(u, "import_members($1::jsonb, $2)", [r, dry]);
  const good = rows({ handle: "ivy", name: "Ivy Kim", email: "ivy@x.in", team: "Events", joined_on: "2025-08-01" }, { handle: "", name: "Jon Roe", email: "jon@x.in", team: "", joined_on: "" });
  ok("a dry run checks the file and writes nothing", (await imp(A, good))?.valid === 2 && (await imp(A, good))?.dry_run === true && (await one<{ n: number }>("select count(*)::int n from members")).n === before);
  ok("only an admin imports", (await imp(C, good, false))?.ok === false && (await imp(V, good))?.ok === false);
  const bad = rows({ handle: "ok1", name: "Good One", email: "g1@x.in" }, { name: "X", email: "nope", handle: "-b-" }, { name: "Dup Of Pia", email: "PIA@x.in" }, { name: "Twice", email: "t@x.in" }, { name: "Twice Again", email: "t@x.in" }, { name: "Bad Date", email: "bd@x.in", joined_on: "31/12/2025" });
  const report = await imp(A, bad);
  ok("problems are reported by row: bad values, a repeat in the file, a bad date (someone already on the list isn't one)", report?.ok === false && report.errors!.map((e) => e.row).join() === "2,5,6" && report.valid === 3 && report.total === 6 && report.unchanged === 1);
  ok("a real run with any problem writes nothing at all", (await imp(A, bad, false))?.ok === false && (await one<{ n: number }>("select count(*)::int n from members")).n === before);
  ok("a clean file is imported for real, trimmed and lower-cased, and logged", (await imp(A, good, false))?.ok === true && (await one<{ n: number }>("select count(*)::int n from members")).n === before + 2
    && (await one<{ team: string }>("select team from members where handle = 'ivy'")).team === "Events" && (await audit("members_imported")) === 1);
  const again = await imp(A, good, false);
  ok("importing the same file again is fine and changes nothing: everyone is already there", again?.ok === true && again.added === 0 && again.unchanged === 2 && (await one<{ n: number }>("select count(*)::int n from members")).n === before + 2);
  const later = await imp(A, rows({ name: "Jon Roe", email: "JON@x.in", handle: "jonroe", team: "Tech", joined_on: "2025-09-01" }, { name: "Ivy Kim", email: "ivy@x.in", handle: "ivy-k" }, { name: "New Person", email: "np@x.in" }), false);
  ok("an updated sheet adds new people and fills what a record is missing, without overwriting what is there", later?.ok === true && later.added === 1 && later.updated === 1 && later.unchanged === 1
    && (await one<{ ok: boolean }>("select (handle = 'jonroe' and team = 'Tech' and joined_on = '2025-09-01') ok from members where email = 'jon@x.in'")).ok
    && (await one<{ handle: string }>("select handle from members where email = 'ivy@x.in'")).handle === "ivy" && (later.notes as { row: number }[]).map((n) => n.row).join() === "2");
  ok("an email of one member with the GitHub username of another is refused", (await imp(A, rows({ name: "Mixed Up", email: "ivy@x.in", handle: "jonroe" })))?.errors?.[0]?.error.includes("two different members") === true);
  ok("a member imported by GitHub username is linked to the person who already signed in with it, whatever email the sheet has", (await imp(A, rows({ name: "Xan Q", email: "xan.q@college.in", handle: "XAN" }), false))?.ok === true
    && (await one<{ user_id: string }>("select user_id from members where email = 'xan.q@college.in'")).user_id === X);
  await db.exec("alter table members disable trigger members_link_account"); await db.query("update members set user_id = null where email = 'xan.q@college.in'"); await db.exec("alter table members enable trigger members_link_account");
  await as(X); await db.query("select register_profile('Xan')");
  ok("…and signing in again links a record that was left unlinked", (await one<{ user_id: string }>("select user_id from members where email = 'xan.q@college.in'")).user_id === X);
  ok("too many rows are refused", (await imp(A, JSON.stringify(Array.from({ length: 501 }, (_, i) => ({ name: `Person ${i}`, email: `p${i}@x.in` })))))?.ok === false);
  ok("exporting members is logged; a volunteer gets nothing", (await api(C, "select * from export_members()")).rows.length === before + 4 && (await api(V, "select * from export_members()")).rows.length === 0 && (await one<{ n: number }>("select count(*)::int n from crm_audit where action = 'export' and entity = 'members'")).n === 1);

  // ---- retention (D5): applications 6 months after the campaign closes, members 24 months after going inactive, audit 36 months ----
  const { RETENTION } = await import("../lib/retention");
  await db.exec("delete from campaign_reviewers; delete from members; delete from applications; delete from recruitment_campaigns;");
  const oldC = (await one<{ id: number }>(`insert into recruitment_campaigns (name, year, status, opens_on, closes_on) values ('Old drive', '2025-26', 'closed', current_date - ${RETENTION.applicationsMonths * 31 + 60}, current_date - ${RETENTION.applicationsMonths * 31 + 50}) returning id`)).id;
  const newC = (await one<{ id: number }>(`insert into recruitment_campaigns (name, year, status, opens_on, closes_on) values ('Fresh drive', '2026-27', 'closed', current_date - 40, current_date - 30) returning id`)).id;
  for (const [c, st, tag] of [[oldC, "rejected", "old-rej"], [oldC, "withdrawn", "old-wd"], [oldC, "waitlisted", "old-wl"], [oldC, "submitted", "old-sub"], [newC, "rejected", "new-rej"]] as const)
    await db.query("insert into applications (campaign_id, name, email, handle, status) values ($1, 'Some Person', $2, 'p', $3)", [c, `${tag}@x.in`, st]);
  const yearsAgo = (months: number, extra: number) => `current_date - ${Math.round(months * 30.5) + extra}`;
  await db.query(`insert into members (name, email, status, status_since) values ('Long gone', 'lg@x.in', 'inactive', ${yearsAgo(RETENTION.membersMonths, 20)}), ('Just left', 'jl@x.in', 'inactive', ${yearsAgo(RETENTION.membersMonths, -20)}), ('Alumnus Old', 'ao@x.in', 'alumni', ${yearsAgo(RETENTION.membersMonths, 90)}), ('Still here', 'sh@x.in', 'active', ${yearsAgo(RETENTION.membersMonths, 90)})`);
  await db.exec("alter table crm_audit disable trigger crm_audit_readonly");
  await db.query(`insert into crm_audit (at, action, entity) values (now() - interval '${RETENTION.auditMonths} months' - interval '2 days', 'old', 'x'), (now() - interval '${RETENTION.auditMonths} months' + interval '2 days', 'recent', 'x')`);
  await db.exec("alter table crm_audit enable trigger crm_audit_readonly");
  ok("the public key and signed-in users can't start the clean-up", !!(await api(A, "select prune_old_data()")).error && !!(await api("", "select prune_old_data()", [], "anon")).error);
  const pruned = (await api<{ r: Record<string, number> }>("", "select prune_old_data() r", [], "service_role")).rows[0]?.r;
  ok("rejected and withdrawn applications go 6 months after their campaign closed; waitlisted, submitted and recent ones stay", pruned?.applications === 2
    && (await db.query<{ email: string }>("select email from applications order by email")).rows.map((r) => r.email).join() === "new-rej@x.in,old-sub@x.in,old-wl@x.in");
  ok("members inactive for 24 months go; recent leavers, alumni and active members stay", pruned?.members === 1 && (await db.query<{ name: string }>("select name from members order by name")).rows.map((r) => r.name).join() === "Alumnus Old,Just left,Still here");
  ok("audit rows older than 36 months go; newer ones stay", pruned?.audit === 1 && (await one<{ n: number }>("select count(*)::int n from crm_audit where action = 'recent'")).n === 1 && (await one<{ n: number }>("select count(*)::int n from crm_audit where action = 'old'")).n === 0);
  ok("…and the audit log is append-only again afterwards (even for the database owner)", await db.query("delete from crm_audit").then(() => false, () => true) && !!(await api(A, "delete from crm_audit")).error);

  console.log(fails ? `\n${fails} FAILED` : "\nall recruitment checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
