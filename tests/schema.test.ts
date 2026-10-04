/* Runs supabase/schema.sql inside PGlite (real Postgres compiled to WASM) and exercises the
   coin functions exactly as the live site calls them. Supabase's auth schema is stubbed:
   auth.uid() reads a setting we switch between users. */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const as = (uid: string) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const one = async <T,>(sql: string, p: unknown[] = []) => (await db.query<T>(sql, p)).rows[0];
const call = async (fn: string, args: unknown[]) => (await one<{ r: { ok: boolean; error?: string; delta?: number; balance?: number } }>(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args)).r;
const coins = async (id: string) => (await one<{ coins: number }>("select coins from profiles where id = $1", [id])).coins;

const ADA = "00000000-0000-0000-0000-00000000000a", ORG = "00000000-0000-0000-0000-00000000000b";

(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    insert into auth.users values ('${ADA}', 'ada@gitam.in', '{"user_name":"ada"}'), ('${ORG}', 'org@gitam.in', '{"user_name":"org"}');
  `);
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  ok("schema.sql runs cleanly on Postgres", true);
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  ok("schema.sql can be run again (updates re-apply without errors)", (await one<{ n: number }>("select count(*)::int n from booths")).n > 0);

  await as(ADA); await db.query("select register_profile('Ada Lovelace')");
  await as(ORG); await db.query("select register_profile('Organiser')");
  ok("register_profile creates profiles with 0 coins", (await coins(ADA)) === 0);
  ok("register_profile is idempotent", (await one<{ n: number }>("select count(*)::int n from profiles")).n === 2 && !!(await db.query("select register_profile('again')")));

  await as(ADA);
  ok("a booth scan before the ticket is verified is refused", !(await call("scan_booth", ["vr"])).ok);
  ok("an attendee can't verify tickets", !(await call("issue_ticket", [ADA, 398])).ok);
  ok("an attendee can't award coins", !(await call("award_coins", [ADA, 1000, "free money"])).ok);
  // someone with no profile (not signed in, or signed in but not registered) has no role at all
  await as("");
  ok("an anonymous visitor can't verify tickets", !(await call("issue_ticket", [ADA, 398])).ok);
  ok("an anonymous visitor can't award coins", !(await call("award_coins", [ADA, 1000, "free money"])).ok);
  await db.query(`insert into auth.users values ('00000000-0000-0000-0000-00000000000c', 'c@x.in', '{"user_name":"cee"}')`);
  await as("00000000-0000-0000-0000-00000000000c");
  ok("a signed-in user without a profile can't award coins", !(await call("award_coins", [ADA, 1000, "free money"])).ok);
  ok("…and nobody got coins from those attempts", (await coins(ADA)) === 0);
  await as(ADA);

  await db.query("update profiles set role = 'admin' where id = $1", [ORG]);
  await as(ORG);
  ok("organiser verifies the ticket", (await call("issue_ticket", [ADA, 398])).ok);
  ok("check-in credits the 398 starter coins", (await coins(ADA)) === 398);
  ok("a second verification is refused", !(await call("issue_ticket", [ADA, 398])).ok && (await coins(ADA)) === 398);

  await as(ADA);
  const vr = await call("scan_booth", ["vr"]);
  ok("VR costs 40 → 358", vr.ok && vr.delta === -40 && vr.balance === 358);
  ok("an immediate second VR scan is blocked (20 s guard)", !(await call("scan_booth", ["vr"])).ok && (await coins(ADA)) === 358);
  const rc = await call("scan_booth", ["recharge-trivia"]);
  ok("a recharge point pays +20 → 378", rc.ok && rc.delta === 20 && rc.balance === 378);
  ok("the same recharge point refuses a second go", !(await call("scan_booth", ["recharge-trivia"])).ok && (await coins(ADA)) === 378);
  ok("a free booth isn't a coin QR", !(await call("scan_booth", ["startup"])).ok);
  ok("an unknown booth is refused", !(await call("scan_booth", ["nope"])).ok);

  ok("buying a sticker pack works → 338", (await call("redeem_reward", ["sticker-pack"])).ok && (await coins(ADA)) === 338);
  ok("stock drops to 199", (await one<{ stock: number }>("select stock from rewards where id='sticker-pack'")).stock === 199);
  await db.query("update profiles set coins = 10 where id = $1", [ADA]);
  ok("you can't buy what you can't afford", !(await call("redeem_reward", ["tee"])).ok && (await coins(ADA)) === 10);
  ok("you can't pay for a booth you can't afford", !(await call("scan_booth", ["git-escape"])).ok && (await coins(ADA)) === 10);

  await as(ORG);
  ok("organiser can't push a balance below zero", !(await call("award_coins", [ADA, -50, "refund"])).ok);
  ok("organiser awards a prize", (await call("award_coins", [ADA, 100, "Fail-Proof Code winner"])).ok && (await coins(ADA)) === 110);

  const lb = await one<{ handle: string; earned: number }>("select handle, earned from leaderboard order by earned desc");
  ok("leaderboard counts earnings (recharge + prize), not the ticket", lb.handle === "ada" && lb.earned === 120);
  ok("ledger has every movement", (await one<{ n: number }>("select count(*)::int n from txs where user_id = $1", [ADA])).n === 5);

  // club sign-ups
  await db.query("insert into join_requests (handle, email, first_event) values ('ada', 'Ada@Gitam.in', '2026-10-07')");
  let dup = false; try { await db.query("insert into join_requests (handle, email, first_event) values ('ada2', 'ada@gitam.in', '2026-10-12')"); } catch (e) { dup = (e as { code?: string }).code === "23505"; }
  ok("join_requests allows one sign-up per email (case-insensitive)", dup);
  let badHandle = false; try { await db.query("insert into join_requests (handle, email, first_event) values ('-nope-', 'x@y.in', '2026-10-07')"); } catch { badHandle = true; }
  ok("join_requests rejects an invalid GitHub handle", badHandle);
  let badEmail = false; try { await db.query("insert into join_requests (handle, email, first_event) values ('bob', 'not-an-email', '2026-10-07')"); } catch { badEmail = true; }
  ok("join_requests rejects an invalid email", badEmail);
  // email: unsubscribe + broadcast log
  await db.query("select unsubscribe_join('ADA@gitam.in')");
  ok("unsubscribe_join marks the address unsubscribed, in any letter case", (await one<{ unsubscribed: boolean }>("select unsubscribed from join_requests where lower(email)='ada@gitam.in'")).unsubscribed === true);
  await as(ORG);
  await db.query("insert into broadcasts (sent_by, subject, recipients) values ($1, 'Hello everyone', 5)", [ORG]);
  ok("an admin can log a broadcast", (await one<{ n: number }>("select count(*)::int n from broadcasts")).n === 1);
  let tooShort = false; try { await db.query("insert into broadcasts (sent_by, subject, recipients) values ($1, 'x', 1)", [ORG]); } catch { tooShort = true; }
  ok("a broadcast with a 1-letter subject is refused", tooShort);
  // get-involved messages
  await as(ADA);
  await db.query("insert into messages (kind, name, email, handle, message) values ('apply','Ada','ada@gitam.in','ada','I would like to help run events.')");
  ok("anyone can send a message", (await one<{ n: number }>("select count(*)::int n from messages")).n === 1);
  let badKind = false; try { await db.query("insert into messages (kind, name, email, message) values ('spam','Ada','a@b.in','a long enough message')"); } catch { badKind = true; }
  ok("an unknown message kind is refused", badKind);
  let shortMsg = false; try { await db.query("insert into messages (kind, name, email, message) values ('question','Ada','a@b.in','hi')"); } catch { shortMsg = true; }
  ok("a too-short message is refused", shortMsg);
  // event feedback
  await db.query("insert into event_feedback (event, rating, liked) values ('2026-10-07', 5, 'Great mentors')");
  ok("anyone can send feedback", (await one<{ n: number }>("select count(*)::int n from event_feedback")).n === 1);
  let r6 = false; try { await db.query("insert into event_feedback (event, rating) values ('2026-10-07', 6)"); } catch { r6 = true; }
  ok("a rating of 6 is refused by the database", r6);

  // ---- attendance, certificates and roles (the /admin dashboard) ----
  await db.query("update profiles set role = 'attendee' where id = $1", [ADA]);
  // run as the API's database role, so row-level security applies like on Supabase
  const asApi = async <T,>(uid: string, sql: string, p: unknown[] = []) => {
    await as(uid); await db.exec("set role authenticated");
    try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
    catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
    finally { await db.exec("reset role"); }
  };
  await db.exec("grant usage on schema public to authenticated; grant select on profiles to authenticated;");
  const add = (uid: string, email: string) => asApi(uid, "insert into attendance (event, name, email) values ('2026-10-07', 'Ada Lovelace', $1) returning id", [email]);
  ok("an attendee can't add attendance", !!(await add(ADA, "ada@gitam.in")).error);
  ok("an attendee can't read attendance", (await asApi(ADA, "select * from attendance")).rows.length === 0);
  const added = await add(ORG, "ada@gitam.in");
  ok("an organiser can add attendance", !added.error && added.rows.length === 1);
  ok("the same person can't be added twice to one event", !!(await add(ORG, "ada@gitam.in")).error);
  ok("emails must be stored lowercase", !!(await add(ORG, "Ada@GITAM.in")).error);
  const certId = (added.rows[0] as { id: string }).id;
  const cert = await asApi<Record<string, unknown>>("", "select * from certificate($1)", [certId]);
  ok("anyone can verify a certificate by its id", cert.rows.length === 1 && cert.rows[0].name === "Ada Lovelace" && cert.rows[0].event === "2026-10-07");
  ok("…without seeing the email address", !("email" in (cert.rows[0] ?? {})));
  ok("an unknown certificate id finds nothing", (await asApi("", "select * from certificate('00000000-0000-0000-0000-000000000099')")).rows.length === 0);

  const role = async (uid: string, handle: string, r: string) => (await asApi<{ r: { ok: boolean; error?: string } }>(uid, "select set_role($1, $2) r", [handle, r])).rows[0]?.r;
  ok("an attendee can't hand out roles", !(await role(ADA, "ada", "admin"))?.ok);
  ok("an admin makes someone a volunteer (any @/case)", (await role(ORG, "@ADA", "volunteer"))?.ok === true && (await one<{ role: string }>("select role from profiles where id = $1", [ADA])).role === "volunteer");
  ok("a volunteer can now read attendance", (await asApi(ADA, "select * from attendance")).rows.length === 1);
  ok("a volunteer still can't hand out roles", !(await role(ADA, "org", "attendee"))?.ok);
  ok("admins can't change their own role", /own role/.test((await role(ORG, "org", "attendee"))?.error ?? ""));
  ok("an unknown handle is explained", /signed in yet/.test((await role(ORG, "nobody-here", "volunteer"))?.error ?? ""));
  ok("a made-up role is refused", !(await role(ORG, "ada", "superuser"))?.ok);

  // ---- reliability: shared rate limits, browser error reports, data retention ----
  // Supabase grants the API roles every table by default, so row-level security is all that stands in the way.
  await db.exec("grant usage on schema public to anon, service_role; grant select, insert, update, delete on all tables in schema public to anon, authenticated;");
  // ---- the Epoch interest list ("notify me when the dates are out") ----
  await db.exec("grant usage on schema public to anon; grant select on epoch_interest to anon, authenticated;");
  const asAnon = async <T,>(sql: string, p: unknown[] = []) => {
    await as(""); await db.exec("set role anon");
    try { return { rows: (await db.query<T>(sql, p)).rows, error: null as string | null }; }
    catch (e) { return { rows: [] as T[], error: (e as Error).message }; }
    finally { await db.exec("reset role"); }
  };
  const hit = async (key: string, limit = 3, secs = 600) => (await asAnon<{ r: boolean }>("select rate_hit($1, $2, $3) r", [key, limit, secs])).rows[0]?.r;
  const hits: (boolean | undefined)[] = []; for (let i = 0; i < 4; i++) hits.push(await hit("join:aaa"));
  ok("rate_hit allows 3 hits in the window, then blocks the 4th", hits.join() === "true,true,true,false");
  ok("…another visitor has their own count", (await hit("join:bbb")) === true);
  ok("…and the same visitor on another form too", (await hit("contact:aaa")) === true);
  await db.query("update rate_hits set window_start = now() - interval '11 minutes' where key = 'join:aaa'");
  ok("once the window has passed, the visitor can try again", (await hit("join:aaa")) === true && (await one<{ hits: number }>("select hits from rate_hits where key = 'join:aaa'")).hits === 1);
  const burst = await Promise.all(Array.from({ length: 10 }, () => hit("join:burst", 5)));
  ok("10 hits at once with a limit of 5: exactly 5 get through", burst.filter(Boolean).length === 5);
  await db.query("insert into rate_hits (key, window_start) values ('join:stale', now() - interval '2 days')");
  await hit("join:ccc");
  ok("rows older than a day are deleted as it goes", (await one<{ n: number }>("select count(*)::int n from rate_hits where key = 'join:stale'")).n === 0);
  ok("a missing or oversized key is refused", (await hit("")) === false && (await hit("k".repeat(101))) === false);
  ok("visitors can't read the counters", (await asAnon("select * from rate_hits")).rows.length === 0);
  ok("…or reset them", (await asAnon("delete from rate_hits returning key")).rows.length === 0 && (await one<{ n: number }>("select count(*)::int n from rate_hits")).n > 0);

  const report = (m: string) => asAnon<{ r: boolean }>("select log_client_error($1, $2, $3, $4) r", [m, "at x (/_next/static/chunks/a.js:1:2)", "/epoch", "Chrome (phone)"]);
  ok("anyone can report a browser error", (await report("TypeError: x is undefined")).rows[0]?.r === true);
  ok("…but nobody can insert into the table directly", !!(await asAnon("insert into client_errors (message, path, browser) values ('x', '/', 'Chrome')")).error);
  ok("a long message is trimmed to 300 characters", (await report("y".repeat(900))).rows[0]?.r === true && (await one<{ n: number }>("select max(length(message))::int n from client_errors")).n === 300);
  ok("an empty report is ignored", (await report("")).rows[0]?.r === false);
  ok("visitors can't read error reports", (await asAnon("select * from client_errors")).rows.length === 0);
  ok("volunteers can't either", (await asApi(ADA, "select * from client_errors")).rows.length === 0);
  ok("admins can", (await asApi(ORG, "select * from client_errors")).rows.length === 2);
  await db.query("insert into client_errors (message, path, browser) select 'flood', '/', 'Chrome' from generate_series(1, 2000)");
  ok("after 2000 reports in a day, more are dropped", (await report("one more")).rows[0]?.r === false);
  await db.query("delete from client_errors where message = 'flood'");

  // retention: rows a day past the period go, rows a day short of it stay — using the numbers /privacy quotes
  const { RETENTION } = await import("../lib/retention");
  await db.exec("delete from join_requests; delete from messages; delete from event_feedback; delete from client_errors;");
  const ago = (n: number, unit: string, days: number) => `now() - interval '${n} ${unit}' + interval '${days} days'`;
  for (const [tag, days] of [["old", -1], ["new", 1]] as const) {
    await db.query(`insert into join_requests (handle, email, first_event, created_at) values ('${tag}', '${tag}@gitam.in', '2026-10-07', ${ago(RETENTION.signUpsMonths, "months", days)})`);
    await db.query(`insert into messages (kind, name, email, message, created_at) values ('question', '${tag}', '${tag}@gitam.in', 'a question long enough', ${ago(RETENTION.messagesMonths, "months", days)})`);
    await db.query(`insert into event_feedback (event, rating, liked, created_at) values ('2026-10-07', 4, '${tag}', ${ago(RETENTION.feedbackMonths, "months", days)})`);
    await db.query(`insert into client_errors (message, path, browser, created_at) values ('${tag}', '/', 'Chrome', ${ago(RETENTION.errorsDays, "days", days)})`);
  }
  ok("visitors can't start the clean-up", !!(await asAnon("select prune_old_data()")).error);
  await db.exec("set role service_role");
  const pruned = (await db.query<{ r: Record<string, number> }>("select prune_old_data() r")).rows[0]?.r;
  await db.exec("reset role");
  ok("prune_old_data deletes one old row of each kind", JSON.stringify(pruned) === JSON.stringify({ signups: 1, messages: 1, feedback: 1, errors: 1 }));
  const left = async (sql: string) => (await db.query<{ v: string }>(sql)).rows.map((r) => r.v).join();
  ok(`sign-ups are kept ${RETENTION.signUpsMonths} months (lib/retention.ts and the SQL agree)`, (await left("select handle v from join_requests")) === "new");
  ok(`messages are kept ${RETENTION.messagesMonths} months`, (await left("select name v from messages")) === "new");
  ok(`feedback is kept ${RETENTION.feedbackMonths} months`, (await left("select liked v from event_feedback")) === "new");
  ok(`error reports are kept ${RETENTION.errorsDays} days`, (await left("select message v from client_errors")) === "new");
  ok("attendance is kept, so certificates stay verifiable", (await one<{ n: number }>("select count(*)::int n from attendance")).n === 1);
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  ok("schema.sql still re-runs cleanly with the new tables in use", (await one<{ n: number }>("select count(*)::int n from client_errors")).n === 1);
  const join = async (email: string) => (await asAnon<{ r: string }>("select epoch_interest_join($1) r", [email])).rows[0]?.r;
  ok("a visitor joins the Epoch interest list through the function", (await join(" Grace@Gitam.in ")) === "created");
  ok("the same address again (any case) is not added twice", (await join("grace@gitam.in")) === "exists" && (await one<{ n: number }>("select count(*)::int n from epoch_interest")).n === 1);
  ok("it's stored trimmed and lowercase", (await one<{ email: string }>("select email from epoch_interest")).email === "grace@gitam.in");
  ok("a broken address is refused", !!(await asAnon("select epoch_interest_join('not-an-email')")).error);
  ok("visitors can't add to the list directly", !!(await asAnon("insert into epoch_interest (email) values ('x@y.in')")).error);
  ok("visitors can't read the list", (await asAnon("select * from epoch_interest")).rows.length === 0);
  ok("volunteers can't read the list either", (await asApi(ADA, "select * from epoch_interest")).rows.length === 0);
  ok("admins can read the list", (await asApi(ORG, "select * from epoch_interest")).rows.length === 1);
  await asAnon("select unsubscribe_join('GRACE@gitam.in')");
  ok("the usual unsubscribe link also takes people off the Epoch list", (await one<{ u: boolean }>("select unsubscribed u from epoch_interest")).u === true);
  ok("someone typing an unsubscribed address in again doesn't re-subscribe it, and is told so", (await join("grace@gitam.in")) === "unsubscribed" && (await one<{ u: boolean }>("select unsubscribed u from epoch_interest")).u === true);

  console.log(fails ? `\n${fails} FAILED` : "\nall schema checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
