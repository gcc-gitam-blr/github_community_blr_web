/* The asset registry and the handover checklist: who may change what, the "no secrets" safety net, the owner and backup
   warnings, and the rule that a handover can't be completed with open items. Runs supabase/schema.sql in PGlite. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
type Res = { ok: boolean; error?: string; id?: number };
const api = async <T,>(uid: string, sql: string, p: unknown[] = [], role: "authenticated" | "anon" | "service_role" = "authenticated") => {
  await as(uid); await db.exec(`set role ${role}`);
  try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
  catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
};
const fn = async (uid: string, call: string, p: unknown[] = []) => { const x = await api<{ r: Res }>(uid, `select ${call} r`, p); if (x.error) console.log("  (sql error in", call, "):", x.error); return x.rows[0]?.r; };
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [A, B, C, D, V, X] = [1, 2, 3, 4, 5, 6].map(id); // admin, second admin, core (asset owner), another core member, volunteer, attendee
type Problem = { id: number; name: string; problem: string; days: number | null };
const warnings = async (u: string) => (await api<{ r: Problem[] }>(u, "select asset_warnings() r")).rows[0].r;
const save = (u: string, idv: number | null, name: string, owner: string | null, backup: string | null, over: { url?: string | null; notes?: string | null; review?: string | null; kind?: string } = {}) =>
  fn(u, "save_asset($1, $2, $3, $4, $5, $6, $7, $8::date)", [idv, name, over.kind ?? "hosting", over.url ?? "https://vercel.com/club", owner, backup, over.notes ?? "Login is in the club password manager", over.review ?? null]);
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

  // ---- the safety net: what counts as a secret ----
  const secret = async (t: string, strict = true) => (await one<{ s: boolean }>("select looks_like_secret($1, $2) s", [t, strict])).s;
  const tokens = ["ghp_" + "a".repeat(36), "github_pat_11ABCDEFG0abcdefghij", "sk-" + "x".repeat(24), "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig", "sb_secret_abc123def456", "xoxb-1234-5678-abcdef", "AKIA" + "A".repeat(16), "-----BEGIN PRIVATE KEY-----", "postgres://admin:hunter22@db.host/x", "https://x.in/hook?token=abcdef123456", "AIza" + "B".repeat(35)];
  ok("known token shapes are caught (GitHub, OpenAI-style, Supabase, Slack, AWS, Google, JWT, private keys, passwords in a URL or ?token=)", (await Promise.all(tokens.map((t) => secret(t)))).every(Boolean));
  ok("a long random-looking run of characters is caught in notes, but not in a link", (await secret("The key is " + "aB3dE5gH7jK9mN1pQ3sT5vX7zC9eF1hJ3")) === true && (await secret("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345", false)) === false);
  ok("ordinary notes, links and sentences are fine", (await Promise.all(["Login is in the club password manager", "Renews every March; ask the treasurer", "https://vercel.com/gcc-gitam/club", "Owner: Cy. Backup: Dan", "2FA codes are on the shared phone"].map((t) => secret(t)))).every((x) => !x));
  ok("an empty value is fine", (await secret("")) === false && (await one<{ s: boolean | null }>("select looks_like_secret(null) s")).s === false);

  // ---- the registry ----
  ok("the usual places are listed, with names and kinds but no owners yet", (await one<{ n: number }>("select count(*)::int n from digital_assets")).n === 11 && (await one<{ n: number }>("select count(*)::int n from digital_assets where owner_id is not null")).n === 0);
  ok("core and admins read the registry; volunteers and attendees don't", (await api(C, "select * from digital_assets")).rows.length === 11 && (await api(V, "select * from digital_assets")).rows.length === 0 && (await api(X, "select * from digital_assets")).rows.length === 0 && (await api("", "select * from digital_assets", [], "anon")).rows.length === 0);
  ok("nobody writes it directly", !!(await api(A, "insert into digital_assets (name, kind) values ('Hack', 'other')")).error && !!(await api(A, "update digital_assets set name = 'x'")).error && !!(await api(A, "delete from digital_assets")).error);
  const vercel = Number((await one<{ id: number }>("select id from digital_assets where name = 'Vercel project'")).id);
  ok("only an admin edits an asset: not a core member, not a volunteer", (await save(C, vercel, "Vercel project", "cy", "dan"))?.ok === false && (await save(V, vercel, "Vercel project", "cy", "dan"))?.ok === false);
  ok("the owner and the backup must hold core or admin appointments, have signed in, and be different people", (await save(A, vercel, "Vercel project", "vi", "dan"))?.ok === false && (await save(A, vercel, "Vercel project", "cy", "xan"))?.ok === false
    && (await save(A, vercel, "Vercel project", "cy", "nobody"))?.ok === false && (await save(A, vercel, "Vercel project", "cy", "@CY"))?.ok === false);
  ok("an admin sets the owner and backup (any @ and letter case), the link, the notes and a review date", (await save(A, vercel, "Vercel project", "@CY", "dan", { review: "2027-03-01" }))?.ok === true
    && (await one<{ ok: boolean }>("select (owner_id = $1 and backup_owner_id = $2 and review_due_on = date '2027-03-01' and location_url = 'https://vercel.com/club') ok from digital_assets where id = $3", [C, D, vercel])).ok);
  ok("a link must be https, with no password in it; a name must be unique; the kind must be a known one", (await save(A, vercel, "Vercel project", "cy", "dan", { url: "http://vercel.com" }))?.ok === false && (await save(A, vercel, "Vercel project", "cy", "dan", { url: "https://user:hunter22@vercel.com" }))?.ok === false
    && (await save(A, null, "vercel PROJECT", null, null))?.ok === false && (await save(A, null, "New thing", null, null, { kind: "bank" }))?.ok === false);
  ok("secrets are refused in a name, the notes or the link", (await save(A, null, "Mail", null, null, { notes: "password is ghp_" + "z".repeat(36) }))?.ok === false && (await save(A, null, "Mail", null, null, { notes: "key: " + "Q".repeat(40) }))?.ok === false
    && (await save(A, null, "ghp_" + "y".repeat(36), null, null))?.ok === false && (await save(A, null, "Mail", null, null, { url: "https://x.in/?apikey=abcdef123456" }))?.ok === false);
  ok("an admin adds a new asset", (await save(A, null, "Canva team", null, null, { kind: "design" }))?.ok === true && (await one<{ n: number }>("select count(*)::int n from digital_assets")).n === 12);
  ok("the owner (not another core member) can update the notes; secrets are refused there too", (await fn(C, "set_asset_notes($1, 'Renewal is every March')", [vercel]))?.ok === true && (await fn(D, "set_asset_notes($1, 'sneaky')", [vercel]))?.ok === false && (await fn(V, "set_asset_notes($1, 'sneaky')", [vercel]))?.ok === false
    && (await fn(C, "set_asset_notes($1, 'token ghp_' || repeat('k', 36))", [vercel]))?.ok === false && (await fn(A, "set_asset_notes($1, 'Admin can too')", [vercel]))?.ok === true);

  // ---- warnings ----
  const all = await warnings(A); const has = (name: string, problem: string) => all.some((w) => w.name === name && w.problem === problem);
  ok("an asset with no owner is flagged", has("Website domain", "no_owner") && has("Instagram", "no_owner"));
  ok("an owner with no backup is flagged", await (async () => { await save(A, null, "Solo asset", "cy", null, { kind: "other" }); return (await warnings(A)).some((w) => w.name === "Solo asset" && w.problem === "no_backup"); })());
  ok("an asset with an owner and a backup who both have access is not flagged", !all.some((w) => w.name === "Vercel project" && ["no_owner", "no_backup", "owner_access_ended"].includes(w.problem)));
  await db.query("update appointments set ends_on = today_ist() + 12 where user_id = $1", [C]);
  ok("an owner whose access ends within 30 days is flagged, with the days left", (await warnings(A)).some((w) => w.name === "Vercel project" && w.problem === "owner_access_ends" && w.days === 12));
  await db.query("update appointments set ends_on = today_ist() - 1, starts_on = today_ist() - 9 where user_id = $1", [C]);
  ok("an owner whose access has ended is flagged", (await warnings(A)).some((w) => w.name === "Vercel project" && w.problem === "owner_access_ended"));
  await db.query("update appointments set ends_on = today_ist() + 100, starts_on = today_ist() where user_id = $1", [C]);
  await db.query("update digital_assets set review_due_on = today_ist() - 4 where id = $1", [vercel]);
  ok("a review that is past due is flagged, with how many days", (await warnings(A)).some((w) => w.name === "Vercel project" && w.problem === "review_overdue" && w.days === 4));
  ok("core members see the warnings; volunteers and attendees get an empty list", (await warnings(C)).length > 0 && (await warnings(V)).length === 0 && (await warnings(X)).length === 0);
  ok("the digest's copy is for the server key only", (await api<{ r: Problem[] }>("", "select asset_problems_for_digest() r", [], "service_role")).rows[0].r.length > 0 && !!(await api(A, "select asset_problems_for_digest()")).error && !!(await api("", "select asset_problems_for_digest()", [], "anon")).error);

  // ---- the handover checklist ----
  ok("only an admin starts a handover", (await fn(C, "start_handover('2027-28')"))?.ok === false && (await fn(V, "start_handover('2027-28')"))?.ok === false && (await fn(A, "start_handover('x')"))?.ok === false);
  const h = Number((await fn(A, "start_handover('2027-28')"))?.id);
  const items = async () => (await db.query<{ id: number; category: string; state: string }>("select id, category, state from handover_items where checklist_id = $1 order by sort", [h])).rows;
  ok("it starts with the rollover steps in 8 groups, all open", h > 0 && (await items()).length === 19 && new Set((await items()).map((i) => i.category)).size === 8 && (await items()).every((i) => i.state === "open"));
  ok("only one handover can be in progress", (await fn(B, "start_handover('2028-29')"))?.ok === false);
  ok("core and admins read the checklist; others don't", (await api(C, "select * from handover_items")).rows.length === 19 && (await api(V, "select * from handover_items")).rows.length === 0 && (await api(X, "select * from handover_checklists")).rows.length === 0);
  ok("only an admin ticks items; nobody writes them directly", (await fn(C, "set_handover_item($1, 'done')", [(await items())[0].id]))?.ok === false && !!(await api(A, "update handover_items set state = 'done'")).error);
  ok("waiving needs a reason; a made-up state is refused; secrets are refused in the note", (await fn(A, "set_handover_item($1, 'waived')", [(await items())[0].id]))?.ok === false && (await fn(A, "set_handover_item($1, 'finished')", [(await items())[0].id]))?.ok === false
    && (await fn(A, "set_handover_item($1, 'done', 'new key ghp_' || repeat('m', 36))", [(await items())[0].id]))?.ok === false);
  ok("completing is refused while items are open, and says how many", /19 items are still open/.test((await fn(A, "complete_handover($1)", [h]))?.error ?? ""));
  for (const [n, i] of (await items()).entries()) await fn(B, n % 5 === 0 ? "set_handover_item($1, 'waived', 'Not applicable this year')" : "set_handover_item($1, 'done')", [i.id]);
  ok("with every item done or waived, only an admin completes it", (await fn(C, "complete_handover($1)", [h]))?.ok === false && (await fn(A, "complete_handover($1)", [h]))?.ok === true
    && (await one<{ ok: boolean }>("select (status = 'complete' and completed_by = $2 and completed_at is not null) ok from handover_checklists where id = $1", [h, A])).ok);
  ok("a completed handover is final: no more ticks, no second completion", (await fn(A, "set_handover_item($1, 'open')", [(await items())[0].id]))?.ok === false && (await fn(A, "complete_handover($1)", [h]))?.ok === false);
  ok("the next year can start a new one", (await fn(A, "start_handover('2028-29')"))?.ok === true);

  // ---- the audit trail ----
  ok("every step was logged", (await audit("asset_created")) >= 2 && (await audit("asset_updated")) >= 1 && (await audit("asset_notes")) === 2 && (await audit("handover_started")) === 2 && (await audit("handover_item")) >= 19 && (await audit("handover_completed")) === 1);
  ok("the log has ids and states only: no asset names, links or notes", (await one<{ n: number }>("select count(*)::int n from crm_audit where entity in ('asset','handover') and detail::text ~* '(vercel|password|renewal|https|gitam)'")).n === 0);
  ok("refused attempts leave no rows", (await one<{ n: number }>("select count(*)::int n from crm_audit where actor in ($1, $2)", [V, X])).n === 0);

  console.log(fails ? `\n${fails} FAILED` : "\nall asset and handover checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
