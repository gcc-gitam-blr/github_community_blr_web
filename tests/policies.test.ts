/* Policies: drafts, publishing by a second admin, and versions that are never changed. Runs supabase/schema.sql in PGlite
   and calls every function as the wrong user too, because the rules live in SQL, not on the page. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

import { AUTH_USERS } from "./auth-stub";
const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
type Res = { ok: boolean; error?: string; id?: number; version?: number };
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" | "service_role" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const fn = async (uid: string, call: string, p: unknown[] = []) => { const x = await api<{ r: Res }>(uid, `select ${call} r`, p); if (x.error) console.log("  (sql error in", call, "):", x.error); return x.rows[0]?.r; };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [A, B, C, V, X] = [1, 2, 3, 4, 5].map(id); // admin, second admin, core, volunteer, attendee
const BODY = "Members treat each other with respect. Harassment of any kind is not tolerated in any club space.";
const publish = (u: string, pid: number, eff = 1, review = 365) => fn(u, "publish_policy_version($1, today_ist() + $2::int, today_ist() + $3::int)", [pid, eff, review]);
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
  for (const [u, h] of [[A, "ada"], [B, "bea"], [C, "cy"], [V, "vi"], [X, "xan"]] as const) {
    await db.query("insert into auth.users values ($1, $2, $3)", [u, `${h}@gitam.in`, JSON.stringify({ user_name: h })]);
    await as(u); await db.query("select register_profile('Person')");
  }
  await as("");
  for (const [u, r] of [[A, "admin"], [B, "admin"], [C, "core"], [V, "volunteer"]] as const) await db.query("insert into appointments (user_id, role, ends_on) values ($1, $2, today_ist() + 100)", [u, r]);

  ok("nothing is seeded: the club writes its own policies", (await one<{ n: number }>("select (select count(*) from policies) + (select count(*) from policy_versions) + (select count(*) from policy_drafts) as n")).n === 0);

  // ---- creating ----
  ok("only an admin creates a policy", (await fn(C, "create_policy('code-of-conduct', 'Code of conduct')"))?.ok === false && (await fn(V, "create_policy('code-of-conduct', 'Code of conduct')"))?.ok === false && (await fn(X, "create_policy('code-of-conduct', 'Code of conduct')"))?.ok === false);
  ok("the short name is lower-case words with dashes, the title 3+ characters", (await fn(A, "create_policy('Code Of Conduct', 'Code of conduct')"))?.ok === false && (await fn(A, "create_policy('code_of_conduct', 'Code of conduct')"))?.ok === false && (await fn(A, "create_policy('coc', 'Hi')"))?.ok === false);
  const coc = Number((await fn(A, "create_policy('code-of-conduct', 'Code of conduct', '@CY')"))?.id);
  ok("an admin creates one, with an owner who holds a core or admin appointment", coc > 0 && (await one<{ o: string }>("select owner_id o from policies where id = $1", [coc])).o === C);
  ok("an owner without access is refused; so is a duplicate short name", (await fn(A, "create_policy('privacy-ops', 'Privacy', 'vi')"))?.ok === false && (await fn(A, "create_policy('code-of-conduct', 'Another')"))?.ok === false);
  ok("only an admin changes the owner", (await fn(C, "set_policy_owner($1, 'bea')", [coc]))?.ok === false && (await fn(A, "set_policy_owner($1, 'bea')", [coc]))?.ok === true && (await fn(A, "set_policy_owner($1, 'xan')", [coc]))?.ok === false);
  ok("core and admins read policies; volunteers and attendees and the public don't", (await api(C, "select * from policies")).rows.length === 1 && (await api(V, "select * from policies")).rows.length === 0 && (await api(X, "select * from policies")).rows.length === 0 && (await api("", "select * from policies", [], "anon")).rows.length === 0);
  ok("nobody writes policies directly", !!(await api(A, "insert into policies (slug, title) values ('x', 'xxx')")).error && !!(await api(A, "update policies set title = 'x'")).error && !!(await api(A, "delete from policies")).error);

  // ---- drafting ----
  ok("only an admin writes a draft; it needs at least a sentence", (await fn(C, "save_policy_draft($1, $2)", [coc, BODY]))?.ok === false && (await fn(A, "save_policy_draft($1, 'short')", [coc]))?.ok === false && (await fn(A, "save_policy_draft(9999, $1)", [BODY]))?.ok === false);
  ok("a draft is saved, and saving again replaces it (one draft per policy)", (await fn(A, "save_policy_draft($1, $2)", [coc, BODY]))?.ok === true && (await fn(A, "save_policy_draft($1, $2)", [coc, BODY + " Reports go to two admins."]))?.ok === true
    && (await one<{ n: number }>("select count(*)::int n from policy_drafts")).n === 1);
  ok("drafts are for admins only", (await api(A, "select * from policy_drafts")).rows.length === 1 && (await api(C, "select * from policy_drafts")).rows.length === 0 && (await api(V, "select * from policy_drafts")).rows.length === 0);

  // ---- publishing: a second admin ----
  ok("the person who wrote the draft can't approve it", /another admin/.test((await publish(A, coc))?.error ?? "") && (await one<{ n: number }>("select count(*)::int n from policy_versions")).n === 0);
  ok("a core member or volunteer can't publish", (await publish(C, coc))?.ok === false && (await publish(V, coc))?.ok === false);
  ok("the dates must make sense: starts today or later, and the review comes after it, within 3 years", (await fn(B, "publish_policy_version($1, today_ist() - 1, today_ist() + 100)", [coc]))?.ok === false && (await publish(B, coc, 5, 5))?.ok === false && (await publish(B, coc, 1, 2000))?.ok === false && (await fn(B, "publish_policy_version($1, null, null)", [coc]))?.ok === false);
  const v1 = await publish(B, coc, 1, 300);
  ok("a second admin publishes version 1 with themselves as approver and the first as author", v1?.ok === true && v1.version === 1
    && (await one<{ ok: boolean }>("select (author_id = $1 and approved_by = $2 and body_md like '%two admins%' and approved_on = today_ist()) ok from policy_versions where policy_id = $3 and version = 1", [A, B, coc])).ok);
  ok("the draft is used up", (await one<{ n: number }>("select count(*)::int n from policy_drafts")).n === 0 && (await publish(B, coc))?.ok === false);
  ok("core and admins read published versions; volunteers and attendees don't", (await api(C, "select * from policy_versions")).rows.length === 1 && (await api(V, "select * from policy_versions")).rows.length === 0 && (await api(X, "select * from policy_versions")).rows.length === 0);

  // ---- versions are never changed ----
  ok("nobody edits or deletes a published version: not through the API, and not even as the database owner", !!(await api(A, "update policy_versions set body_md = 'changed'")).error && !!(await api(A, "delete from policy_versions")).error
    && await db.query("update policy_versions set body_md = 'rewritten text of the policy'").then(() => false, () => true) && await db.query("delete from policy_versions").then(() => false, () => true));
  ok("nobody writes versions directly", !!(await api(A, "insert into policy_versions (policy_id, version, body_md, effective_on, review_due_on) values ($1, 2, 'sneaky edit of the policy', today_ist(), today_ist() + 9)", [coc])).error);

  // ---- a change is a new version; the old one stays ----
  await fn(B, "save_policy_draft($1, $2)", [coc, BODY + " Reports go to two admins. Appeals go to the faculty advisor."]);
  ok("the author of the second draft can't approve it either", (await publish(B, coc))?.ok === false);
  const v2 = await publish(A, coc, 1, 365);
  ok("the other admin publishes version 2; version 1 is still there, word for word", v2?.version === 2 && (await db.query<{ version: number; body_md: string }>("select version, body_md from policy_versions where policy_id = $1 order by version", [coc])).rows.map((r) => r.version + ":" + r.body_md.length).join() === `1:${(BODY + " Reports go to two admins.").length},2:${(BODY + " Reports go to two admins. Appeals go to the faculty advisor.").length}`);
  ok("a draft can be thrown away; only by an admin", await (async () => { await fn(A, "save_policy_draft($1, $2)", [coc, "A draft nobody wants to publish after all, really."]); const no = await fn(C, "discard_policy_draft($1)", [coc]); const yes = await fn(B, "discard_policy_draft($1)", [coc]); return no?.ok === false && yes?.ok === true && (await one<{ n: number }>("select count(*)::int n from policy_drafts")).n === 0; })());

  // ---- reviews that are due ----
  const rd = async () => (await api<{ r: { id: number; days: number }[] }>("", "select policy_reviews_due() r", [], "service_role")).rows[0].r;
  ok("a policy within its review date is not due", (await rd()).length === 0);
  const hist = await fn(A, "create_policy('privacy-ops', 'How we handle personal data')");
  await fn(A, "save_policy_draft($1, 'We keep as little personal data as we can, and delete it on schedule.')", [hist!.id]);
  await publish(B, hist!.id!, 0, 30);
  await db.exec("alter table policy_versions disable trigger policy_versions_guard");
  await db.query("update policy_versions set review_due_on = today_ist() - 6, effective_on = today_ist() - 400 where policy_id = $1", [hist!.id]);
  await db.exec("alter table policy_versions enable trigger policy_versions_guard");
  ok("a policy whose latest version is past its review date is due, with how many days", (await rd()).some((x) => x.id === hist!.id && x.days === 6) && !(await rd()).some((x) => x.id === coc));
  ok("only the latest version counts: publishing a new one clears it", await (async () => { await fn(A, "save_policy_draft($1, 'We keep even less personal data now, and delete it sooner.')", [hist!.id]); await publish(B, hist!.id!, 0, 300); return !(await rd()).some((x) => x.id === hist!.id); })());
  ok("the review list is for the server key only", !!(await api(A, "select policy_reviews_due()")).error && !!(await api("", "select policy_reviews_due()", [], "anon")).error);

  // ---- the audit trail ----
  ok("every step was logged", (await audit("policy_created")) === 2 && (await audit("policy_owner")) === 1 && (await audit("policy_draft")) >= 5 && (await audit("policy_draft_discarded")) === 1 && (await audit("policy_published")) === 4);
  ok("the log has ids and version numbers only: no policy text or titles", (await one<{ n: number }>("select count(*)::int n from crm_audit where entity = 'policy' and detail::text ~* '(respect|harassment|personal data|conduct)'")).n === 0);
  ok("refused attempts leave no rows", (await one<{ n: number }>("select count(*)::int n from crm_audit where actor in ($1, $2, $3)", [C, V, X])).n === 0);

  console.log(fails ? `\n${fails} FAILED` : "\nall policy checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
