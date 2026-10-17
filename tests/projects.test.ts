/* The project hub: the interest survey, ideas and teams, requests, and featuring a project on the website. Runs
   supabase/schema.sql in PGlite and calls every function as the wrong user too, because the rules live in SQL. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { DOMAINS, REPO_RE, parseSkills } from "../lib/projects";

const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
type Res = { ok: boolean; error?: string; id?: number; back_to_review?: boolean };
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" | "service_role" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const fn = async (uid: string, call: string, p: unknown[] = []) => { const x = await api<{ r: Res }>(uid, `select ${call} r`, p); if (x.error) console.log("  (sql error in", call, "):", x.error); return x.rows[0]?.r; };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
// admin, second admin, core, members Mia / Noa / Ola (active), Pat (inactive member), Quin (signed in, not a member)
const [A, B, C, M1, M2, M3, PAT, Q] = [1, 2, 3, 4, 5, 6, 7, 8].map(id);
const interests = (u: string, domains: string, skills: string, found = true, wants = "A small tool that helps first-years", hours = "3-5") =>
  fn(u, "save_interests($1::text[], $2::text[], $3, $4, $5)", [`{${domains}}`, `{${skills}}`, wants, hours, found]);
const idea = (u: string, title = "Club event finder", team: number | null = 4, over: { domains?: string; skills?: string; repo?: string | null; club?: boolean } = {}) =>
  fn(u, "post_idea($1, 'A small web app that lists upcoming club events and lets people save the ones they like.', $2::text[], $3::text[], $4, $5, $6)", [title, `{${over.domains ?? "web"}}`, `{${over.skills ?? "react,node.js"}}`, team, over.repo ?? null, over.club ?? false]);
const audit = async (action: string) => (await one<{ n: number }>("select count(*)::int n from crm_audit where action = $1", [action])).n;
const members = async (pid: number) => (await db.query<{ user_id: string; role: string }>("select user_id, role from project_members where project_id = $1", [pid])).rows;

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
  const people: [string, string][] = [[A, "ada"], [B, "bea"], [C, "cy"], [M1, "mia"], [M2, "noa"], [M3, "ola"], [PAT, "pat"], [Q, "quin"]];
  for (const [u, h] of people) { await db.query("insert into auth.users values ($1, $2, $3)", [u, `${h}@gitam.in`, JSON.stringify({ user_name: h })]); await as(u); await db.query("select register_profile('Person ' || $1)", [h]); }
  await as("");
  for (const [u, r] of [[A, "admin"], [B, "admin"], [C, "core"]] as const) await db.query("insert into appointments (user_id, role, ends_on) values ($1, $2, today_ist() + 100)", [u, r]);
  for (const [h, st] of [["mia", "active"], ["noa", "active"], ["ola", "active"], ["pat", "inactive"]] as const) await db.query("insert into members (name, email, handle, status, user_id) select initcap($1), $1 || '@gitam.in', $1, $2, id from profiles where handle = $1", [h, st]);

  // ---- the lists agree ----
  ok("the areas in the app are the areas in the database", JSON.stringify((await one<{ d: string[] }>("select domain_list() d")).d) === JSON.stringify(DOMAINS.map((d) => d.id)));
  ok("skills typed by people are tidied the way the database expects", JSON.stringify(parseSkills(" React, node.js ,  Python,react")) === JSON.stringify(["react", "node.js", "python"]) && parseSkills("a") === null && parseSkills("bad/skill") === null && parseSkills("1a,2b,3c,4d,5e,6f,7g,8h,9i") === null);
  ok("a repository link must be a github.com address", REPO_RE.test("https://github.com/gcc-gitam-blr/club-site") && !REPO_RE.test("https://gitlab.com/a/b") && !REPO_RE.test("http://github.com/a/b") && !REPO_RE.test("https://github.com/a"));

  // ---- who takes part ----
  ok("active members and the core team can use the hub; an inactive member and someone who is not a member can't", (await api<{ r: boolean }>(M1, "select can_take_part() r")).rows[0].r && (await api<{ r: boolean }>(C, "select can_take_part() r")).rows[0].r
    && !(await api<{ r: boolean }>(PAT, "select can_take_part() r")).rows[0].r && !(await api<{ r: boolean }>(Q, "select can_take_part() r")).rows[0].r);
  ok("the public key can't use any of it", !!(await api("", "select save_interests('{web}', '{}', null, null, false)", [], "anon")).error && (await api("", "select * from project_ideas", [], "anon")).rows.length === 0 && !!(await api("", "select can_take_part()", [], "anon")).error);

  // ---- the interest survey ----
  ok("someone who isn't an active member is refused", (await interests(Q, "web", "react"))?.ok === false && (await interests(PAT, "web", "react"))?.ok === false);
  ok("an area must be on the list, 1 to 5 of them", (await interests(M1, "web,quantum", "react"))?.ok === false && (await interests(M1, "", "react"))?.ok === false && (await interests(M1, "web,mobile,ai-ml,data,security,game-dev", "react"))?.ok === false);
  ok("skills are limited: 8 at most, tidy characters only", (await interests(M1, "web", "a1,b2,c3,d4,e5,f6,g7,h8,i9"))?.ok === false && (await interests(M1, "web", "bad/skill"))?.ok === false);
  ok("hours, length and secrets in the free text are checked", (await interests(M1, "web", "react", true, "x", "40"))?.ok === false && (await interests(M1, "web", "react", true, "y".repeat(281)))?.ok === false && (await interests(M1, "web", "react", true, "my key is ghp_" + "z".repeat(36)))?.ok === false);
  ok("a member saves their answers, tidied (lower-case, no repeats); saving again replaces them", (await interests(M1, "web,ai-ml", "React,Node.js,react", true))?.ok === true && (await interests(M1, "web,ai-ml", "react,node.js,python", true))?.ok === true
    && (await one<{ s: string }>("select skills::text s from member_interests where user_id = $1", [M1])).s === "{react,node.js,python}" && (await one<{ n: number }>("select count(*)::int n from member_interests")).n === 1);
  await interests(M2, "web,design-ux", "figma,react", true); await interests(M3, "web", "python", false); await interests(C, "ai-ml", "python,ml", true);
  ok("you read only your own answers; the core team and admins read all; the public reads none", (await api(M1, "select * from member_interests")).rows.length === 1 && (await api(M2, "select * from member_interests")).rows.length === 1
    && (await api(C, "select * from member_interests")).rows.length === 4 && (await api(A, "select * from member_interests")).rows.length === 4 && (await api(Q, "select * from member_interests")).rows.length === 0);
  ok("nobody writes the answers directly", !!(await api(M1, "update member_interests set domains = '{web}'")).error && !!(await api(M1, "insert into member_interests (user_id, domains) values ($1, '{web}')", [Q])).error && !!(await api(A, "delete from member_interests")).error);

  type Sum = { allowed: boolean; responses: number; members: number | null; domains: { domain: string; count: number | null }[]; skills: { skill: string; count: number }[] };
  const sum = async (u: string) => (await api<{ r: Sum }>(u, "select survey_summary() r")).rows[0].r;
  const s1 = await sum(C), s2 = await sum(M1);
  ok("the core team sees exact counts and how many active members there are", s1.responses === 4 && s1.members === 3 && s1.domains.find((d) => d.domain === "web")?.count === 3 && s1.domains.find((d) => d.domain === "design-ux")?.count === 1);
  ok("a member sees a count only where at least 3 people share it, so a small number can't point at one person", s2.members === null && s2.domains.find((d) => d.domain === "web")?.count === 3 && s2.domains.find((d) => d.domain === "design-ux")?.count === null && !s2.skills.some((k) => k.skill === "figma"));
  ok("someone outside the hub gets nothing", (await sum(Q)).allowed === false);

  // ---- finding teammates ----
  const find = async (u: string, dom: string | null, skill: string | null) => (await api<{ handle: string; skills: string[] }>(u, "select * from find_teammates($1, $2)", [dom, skill])).rows;
  ok("members find only people who ticked 'let teammates find me': Mia, Noa and Cy, but not Ola", (await find(M2, "web", null)).map((r) => r.handle).sort().join() === "mia" && (await find(M1, null, null)).map((r) => r.handle).sort().join() === "cy,noa");
  ok("…by skill, by the start of a skill, and never themselves", (await find(M2, null, "react")).map((r) => r.handle).join() === "mia" && (await find(M3, null, "rea")).map((r) => r.handle).sort().join() === "mia,noa" && !(await find(M1, null, null)).some((r) => r.handle === "mia"));
  ok("the core team shows up too when they opt in, an inactive member never does", (await find(M1, "ai-ml", null)).some((r) => r.handle === "cy"));
  await db.query("update members set status = 'inactive' where handle = 'noa'");
  ok("a member who leaves the club stops being findable at once", !(await find(M1, null, null)).some((r) => r.handle === "noa"));
  await db.query("update members set status = 'active' where handle = 'noa'");
  ok("someone outside the hub finds nobody", (await find(Q, null, null)).length === 0 && (await find(PAT, null, null)).length === 0);

  // ---- ideas ----
  ok("only members post; an idea needs a size, 1-3 areas, a real summary and a github repo", (await idea(Q))?.ok === false && (await idea(PAT))?.ok === false && (await idea(M1, "Needs size", null))?.ok === false && (await idea(M1, "Too many areas", 4, { domains: "web,mobile,data,security" }))?.ok === false
    && (await idea(M1, "Bad repo", 4, { repo: "https://gitlab.com/a/b" }))?.ok === false && (await fn(M1, "post_idea('Tiny', 'short', '{web}', '{}', 4, null, false)"))?.ok === false);
  ok("secrets are refused in an idea", (await fn(M1, "post_idea('Key leak', 'Use the key ghp_' || repeat('q', 36) || ' to deploy the thing', '{web}', '{}', 4, null, false)"))?.ok === false);
  const p1 = Number((await idea(M1))?.id);
  ok("a member posts an idea and becomes its owner and first team member", p1 > 0 && (await one<{ ok: boolean }>("select (owner_id = $2 and status = 'idea' and origin = 'member' and publish_state = 'private') ok from project_ideas where id = $1", [p1, M1])).ok && (await members(p1)).length === 1);
  ok("members read ideas and teams; non-members don't", (await api(M2, "select * from project_ideas")).rows.length === 1 && (await api(M2, "select * from project_members")).rows.length === 1 && (await api(Q, "select * from project_ideas")).rows.length === 0 && (await api(PAT, "select * from project_members")).rows.length === 0);
  ok("nobody writes ideas, teams or requests directly", !!(await api(M1, "update project_ideas set publish_state = 'published'")).error && !!(await api(M1, "insert into project_members (project_id, user_id) values ($1, $2)", [p1, M2])).error && !!(await api(M1, "delete from project_ideas")).error && !!(await api(M2, "insert into project_requests (project_id, user_id) values ($1, $2)", [p1, M2])).error);
  ok("only the core team posts a club project, which can be open to everyone", (await idea(M1, "Club-wide thing", null, { club: true }))?.ok === false && (await idea(C, "Club learning hub", null, { club: true }))?.ok === true && (await one<{ o: string }>("select origin o from project_ideas where title = 'Club learning hub'")).o === "club");
  ok("a member can have at most 5 active projects", await (async () => { for (let i = 0; i < 5; i++) await idea(M3, `Idea number ${i}`); return (await idea(M3, "One idea too many"))?.ok === false; })());

  // ---- editing, status ----
  const upd = (u: string, pid: number, title = "Club event finder v2", team: number | null = 5, repo: string | null = null) => fn(u, "update_idea($1, $2, 'A small web app that lists upcoming club events and lets people save their favourites.', '{web}', '{react}', $3, $4)", [pid, title, team, repo]);
  ok("only the owner edits", (await upd(M2, p1))?.ok === false && (await upd(C, p1))?.ok === false && (await upd(M1, p1))?.ok === true && (await one<{ t: string }>("select title t from project_ideas where id = $1", [p1])).t === "Club event finder v2");
  ok("the team can't be made smaller than it already is", await (async () => { const made = await idea(M1, "Pair project", 2); if (!made?.ok) console.log("  (pair project:", made?.error, ")"); const a = Number(made?.id); await fn(M2, "request_to_join($1, 'hi')", [a]); const r = Number((await one<{ id: number }>("select id from project_requests where project_id = $1", [a])).id); await fn(M1, "decide_request($1, true)", [r]); return (await upd(M1, a, "Pair project", 1))?.ok === false; })());
  ok("status moves along its steps: idea → forming → building → shipped, and only the owner or an admin moves it", (await fn(M2, "set_idea_status($1, 'building')", [p1]))?.ok === false && (await fn(M1, "set_idea_status($1, 'shipped')", [p1]))?.ok === false && (await fn(M1, "set_idea_status($1, 'forming')", [p1]))?.ok === true
    && (await fn(M1, "set_idea_status($1, 'building')", [p1]))?.ok === true && (await fn(M1, "set_idea_status($1, 'bogus')", [p1]))?.ok === false);

  // ---- requests and teams ----
  ok("the owner can't ask to join their own project; a stranger can't ask", (await fn(M1, "request_to_join($1, 'me')", [p1]))?.ok === false && (await fn(Q, "request_to_join($1, 'let me in')", [p1]))?.ok === false && (await fn(PAT, "request_to_join($1, 'let me in')", [p1]))?.ok === false);
  ok("a member asks to join; asking twice is refused; a long message or a secret is refused", (await fn(M2, "request_to_join($1, 'I know React and can help with the design')", [p1]))?.ok === true && (await fn(M2, "request_to_join($1, 'again')", [p1]))?.ok === false
    && (await fn(M3, "request_to_join($1, $2)", [p1, "x".repeat(301)]))?.ok === false && (await fn(M3, "request_to_join($1, 'token ghp_' || repeat('p', 36))", [p1]))?.ok === false);
  const req = Number((await one<{ id: number }>("select id from project_requests where project_id = $1 and user_id = $2", [p1, M2])).id);
  ok("requests are seen by their sender, the project's owner and the core team, and nobody else", (await api(M2, "select * from project_requests")).rows.length >= 1 && (await api(M1, "select * from project_requests where project_id = $1", [p1])).rows.length === 1
    && (await api(C, "select * from project_requests where project_id = $1", [p1])).rows.length === 1 && (await api(M3, "select * from project_requests where project_id = $1", [p1])).rows.length === 0);
  ok("only the owner (or an admin) answers: not the requester, not another member, not the core team", (await fn(M2, "decide_request($1, true)", [req]))?.ok === false && (await fn(M3, "decide_request($1, true)", [req]))?.ok === false && (await fn(C, "decide_request($1, true)", [req]))?.ok === false);
  ok("accepting adds the person to the team", (await fn(M1, "decide_request($1, true)", [req]))?.ok === true && (await members(p1)).some((m) => m.user_id === M2 && m.role === "member") && (await fn(M1, "decide_request($1, true)", [req]))?.ok === false);
  ok("declining closes the request, and the person can't keep asking", await (async () => { await fn(M3, "request_to_join($1, 'me too')", [p1]); const r = Number((await one<{ id: number }>("select id from project_requests where project_id = $1 and user_id = $2", [p1, M3])).id); const d = await fn(M1, "decide_request($1, false)", [r]); const again = await fn(M3, "request_to_join($1, 'please')", [p1]); return d?.ok === true && again?.ok === false; })());
  ok("a full team refuses more requests and more acceptances", await (async () => {
    const f = Number((await idea(C, "Duo", 2))?.id); await fn(M1, "request_to_join($1, 'in')", [f]); const r1 = Number((await one<{ id: number }>("select id from project_requests where project_id = $1", [f])).id); await fn(C, "decide_request($1, true)", [r1]);
    const late = await fn(M2, "request_to_join($1, 'too late')", [f]); return late?.ok === false && /full/.test(late.error ?? ""); })());
  ok("a member leaves; the owner can't; the owner (or an admin) can remove someone", (await fn(M2, "leave_project($1)", [p1]))?.ok === true && (await fn(M1, "leave_project($1)", [p1]))?.ok === false && (await fn(M3, "remove_project_member($1, $2)", [p1, M1]))?.ok === false
    && await (async () => { await fn(M2, "request_to_join($1, 'back again')", [p1]); const r = Number((await one<{ id: number }>("select id from project_requests where project_id = $1 and user_id = $2", [p1, M2])).id); await fn(M1, "decide_request($1, true)", [r]); return (await fn(M1, "remove_project_member($1, $2)", [p1, M2]))?.ok === true && (await fn(M1, "remove_project_member($1, $2)", [p1, M1]))?.ok === false; })());
  ok("a withdrawn request is gone from the pending list", await (async () => { const g = Number((await idea(C, "Third wheel", 3, {}))?.id); await fn(M2, "request_to_join($1, 'hi')", [g]); const r = Number((await one<{ id: number }>("select id from project_requests where project_id = $1", [g])).id); return (await fn(M3, "withdraw_request($1)", [r]))?.ok === false && (await fn(M2, "withdraw_request($1)", [r]))?.ok === true && (await fn(M2, "withdraw_request($1)", [r]))?.ok === false; })());
  ok("an admin hands a project to someone already on its team", (await fn(A, "set_project_owner($1, 'noa')", [p1]))?.ok === false && await (async () => { await fn(M2, "request_to_join($1, 'hello')", [p1]); const r = Number((await one<{ id: number }>("select id from project_requests where project_id = $1 and user_id = $2", [p1, M2])).id); await fn(M1, "decide_request($1, true)", [r]);
    const no = await fn(C, "set_project_owner($1, 'noa')", [p1]); const yes = await fn(A, "set_project_owner($1, 'noa')", [p1]); return no?.ok === false && yes?.ok === true && (await members(p1)).filter((m) => m.role === "owner").length === 1 && (await one<{ o: string }>("select owner_id o from project_ideas where id = $1", [p1])).o === M2; })());
  await fn(A, "set_project_owner($1, 'mia')", [p1]);

  // ---- the website ----
  const pub = async () => (await api<{ r: { id: number; title: string; people: string[]; team_count: number; club: boolean }[] }>("", "select public_projects() r", [], "service_role")).rows[0].r;
  ok("nothing is public to start with, and the public list is for the server only", (await pub()).length === 0 && !!(await api(M1, "select public_projects()")).error && !!(await api("", "select public_projects()", [], "anon")).error);
  const p2 = Number((await idea(M1, "Open timetable", 5))?.id);
  ok("a project must be in progress, with a real summary, before it can be featured; only the owner asks", (await fn(M1, "request_publishing($1)", [p2]))?.ok === false && (await fn(M1, "set_idea_status($1, 'building')", [p2]))?.ok === true && (await fn(M2, "request_publishing($1)", [p2]))?.ok === false && (await fn(M1, "request_publishing($1)", [p2]))?.ok === true);
  ok("asking twice is refused; it is still not public", (await fn(M1, "request_publishing($1)", [p2]))?.ok === false && (await pub()).length === 0);
  ok("a member can't feature a project; the owner (as core or admin) can't review their own", (await fn(M2, "decide_publishing($1, true)", [p2]))?.ok === false && await (async () => { await db.query("update project_ideas set owner_id = $2 where id = $1", [p2, C]); await db.query("update project_members set user_id = $2 where project_id = $1 and role = 'owner'", [p2, C]);
    const own = await fn(C, "decide_publishing($1, true)", [p2]); await db.query("update project_ideas set owner_id = $2 where id = $1", [p2, M1]); await db.query("update project_members set user_id = $2 where project_id = $1 and role = 'owner'", [p2, M1]); return own?.ok === false && /own project/.test(own.error ?? ""); })());
  ok("sending it back needs a reason, then the team can ask again", (await fn(C, "decide_publishing($1, false)", [p2]))?.ok === false && (await fn(C, "decide_publishing($1, false, 'Add what the project does for students')", [p2]))?.ok === true
    && (await one<{ s: string; n: string }>("select publish_state s, publish_note n from project_ideas where id = $1", [p2])).s === "private" && (await fn(M1, "request_publishing($1)", [p2]))?.ok === true);
  ok("a core member or admin who is not the owner features it", (await fn(C, "decide_publishing($1, true)", [p2]))?.ok === true && (await pub()).length === 1);
  ok("the public list shows the title, the team size, and no names at all until members agree", (await pub())[0].title === "Open timetable" && (await pub())[0].team_count === 1 && (await pub())[0].people.length === 0);
  ok("each member chooses whether their GitHub name is shown; only they can change it", (await fn(M1, "set_public_credit($1, true)", [p2]))?.ok === true && (await fn(M3, "set_public_credit($1, true)", [p2]))?.ok === false && (await pub())[0].people.join() === "mia");
  ok("editing what the public sees sends it back for review and takes it off the site", (await fn(M1, "update_idea($1, 'Open timetable for everyone', 'A shared timetable that any club can plug their events into, with reminders.', '{web}', '{react}', 5, null)", [p2]))?.back_to_review === true && (await pub()).length === 0);
  ok("changing only the team size doesn't", await (async () => { await fn(C, "decide_publishing($1, true)", [p2]); const r = await fn(M1, "update_idea($1, 'Open timetable for everyone', 'A shared timetable that any club can plug their events into, with reminders.', '{web}', '{react}', 6, null)", [p2]); return r?.ok === true && r.back_to_review === false && (await pub()).length === 1; })());
  ok("the owner or the core team can take it off the site; archiving does too", (await fn(M2, "unpublish_project($1)", [p2]))?.ok === false && (await fn(M1, "unpublish_project($1)", [p2]))?.ok === true && (await pub()).length === 0
    && await (async () => { await fn(M1, "request_publishing($1)", [p2]); await fn(C, "decide_publishing($1, true)", [p2]); const on = (await pub()).length; await fn(M1, "set_idea_status($1, 'archived')", [p2]); return on === 1 && (await pub()).length === 0; })());
  ok("archiving withdraws pending requests; only an admin brings a project back", await (async () => { const g = Number((await idea(C, "Short-lived", 3))?.id); await fn(M2, "request_to_join($1, 'hello there')", [g]); await fn(C, "set_idea_status($1, 'archived')", [g]);
    const gone = (await one<{ s: string }>("select status s from project_requests where project_id = $1", [g])).s === "withdrawn"; return gone && (await fn(C, "set_idea_status($1, 'idea')", [g]))?.ok === false && (await fn(A, "set_idea_status($1, 'idea')", [g]))?.ok === true; })());

  // ---- retention ----
  await db.query("insert into member_interests (user_id, domains) values ($1, '{web}'), ($2, '{web}')", [Q, PAT]); // Quin is not a member; Pat is a (former) member with a record
  const pruned = (await api<{ r: { interests: number } }>("", "select prune_old_data() r", [], "service_role")).rows[0].r;
  ok("the weekly clean-up deletes answers of people who are no longer members or on the core team, and keeps the rest", pruned.interests === 1
    && (await one<{ n: number }>("select count(*)::int n from member_interests where user_id = $1", [Q])).n === 0 && (await one<{ n: number }>("select count(*)::int n from member_interests where user_id in ($1, $2, $3, $4)", [M1, M2, C, PAT])).n === 4);
  ok("anyone can delete their own answers at any time", (await fn(M1, "delete_interests()"))?.ok === true && (await one<{ n: number }>("select count(*)::int n from member_interests where user_id = $1", [M1])).n === 0 && (await one<{ n: number }>("select count(*)::int n from member_interests where user_id = $1", [M2])).n === 1);

  // ---- the audit trail ----
  ok("every step was logged", (await audit("interests_saved")) >= 4 && (await audit("idea_posted")) >= 6 && (await audit("idea_updated")) >= 3 && (await audit("idea_status")) >= 4 && (await audit("request_sent")) >= 6 && (await audit("request_decided")) >= 4
    && (await audit("member_left_project")) === 1 && (await audit("project_member_removed")) === 1 && (await audit("project_owner")) >= 2 && (await audit("public_credit")) === 1 && (await audit("publish_requested")) >= 3 && (await audit("publish_decided")) >= 3 && (await audit("project_unpublished")) === 1 && (await audit("request_withdrawn")) === 1);
  ok("the log has ids and states only: no titles, summaries, skills, wishes or messages", (await one<{ n: number }>("select count(*)::int n from crm_audit where entity in ('interests','project') and detail::text ~* '(react|timetable|figma|first-years|python|design|hello)'")).n === 0);
  ok("refused attempts leave no rows", (await one<{ n: number }>("select count(*)::int n from crm_audit where actor in ($1, $2)", [Q, PAT])).n === 0);

  console.log(fails ? `\n${fails} FAILED` : "\nall project hub checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
