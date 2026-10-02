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
    create role anon; create role authenticated;
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

  console.log(fails ? `\n${fails} FAILED` : "\nall schema checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
