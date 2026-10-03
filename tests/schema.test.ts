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

  // ---- Epoch organisers: booths for volunteers, reversals, search and the audit log ----
  const [VOL, DESK, REC, BEA, CY] = ["d", "e", "f", "1b", "1c"].map((s) => `00000000-0000-0000-0000-0000000000${s.padStart(2, "0")}`);
  await db.query(`insert into auth.users values ('${VOL}', 'vol@x.in', '{"user_name":"vol"}'), ('${DESK}', 'desk@x.in', '{"user_name":"desk"}'), ('${REC}', 'rec@x.in', '{"user_name":"rec"}'), ('${BEA}', 'bea@gitam.in', '{"user_name":"bea"}'), ('${CY}', 'cy@gitam.in', '{"user_name":"cy_99"}')`);
  for (const [id, n] of [[VOL, "Val"], [DESK, "Desk Person"], [REC, "Rec"], [BEA, "Bea Bhat"], [CY, "Cy"]]) { await as(id); await db.query("select register_profile($1)", [n]); }
  await db.exec("grant select, insert on audit_log to authenticated;"); // what Supabase grants by default; row-level security decides
  const rpc = async (uid: string, fn: string, args: unknown[]) => { await as(uid); return call(fn, args); };
  const assign = (uid: string, h: string, b: string | null) => rpc(uid, "assign_booth", [h, b]);
  for (const h of ["vol", "desk", "rec"]) await role(ORG, h, "volunteer");
  ok("only admins assign booths", !(await assign(VOL, "vol", "vr")).ok);
  ok("an attendee can't be put on a booth", /volunteer role first/.test((await assign(ORG, "bea", "vr")).error ?? ""));
  ok("a free booth (no coins) can't be assigned", !(await assign(ORG, "vol", "startup")).ok);
  ok("an admin puts volunteers on their booths", (await assign(ORG, "vol", "vr")).ok && (await assign(ORG, "@REC", "recharge-puzzle")).ok);
  ok("…and it's stored on the profile", (await one<{ booth: string }>("select booth from profiles where id = $1", [VOL])).booth === "vr");

  ok("a desk volunteer (no booth) checks a ticket in", (await rpc(DESK, "issue_ticket", [BEA, 398])).ok && (await coins(BEA)) === 398);
  ok("a booth volunteer can check people in too", (await rpc(VOL, "issue_ticket", [CY, 398])).ok);
  ok("a desk volunteer can't scan for a booth", /on the desk/.test((await rpc(DESK, "staff_scan", [BEA, "vr"])).error ?? ""));
  ok("volunteers can't award coins any more", /Only admins/.test((await rpc(VOL, "award_coins", [BEA, 50, "prize"])).error ?? "") && (await coins(BEA)) === 398);
  ok("a volunteer can't scan for someone else's booth", /own booth/.test((await rpc(VOL, "staff_scan", [BEA, "retro"])).error ?? ""));
  const vrBea = await rpc(VOL, "staff_scan", [BEA, "vr"]);
  ok("the VR volunteer charges Bea from her wallet QR → 358", vrBea.ok && vrBea.delta === -40 && (await coins(BEA)) === 358);
  ok("the same 20-second double-scan guard applies", !(await rpc(VOL, "staff_scan", [BEA, "vr"])).ok && (await coins(BEA)) === 358);
  ok("a booth can't charge an unknown attendee", /Unknown attendee/.test((await rpc(VOL, "staff_scan", ["00000000-0000-0000-0000-000000000099", "vr"])).error ?? ""));

  const txOf = async (uid: string, ref: string) => (await one<{ id: number }>("select id from txs where user_id = $1 and ref = $2 order by id desc limit 1", [uid, ref])).id;
  const vrTx = await txOf(BEA, "booth:vr");
  ok("an attendee can't reverse anything", !(await rpc(BEA, "reverse_tx", [vrTx, ""])).ok);
  ok("a desk volunteer can't reverse a booth charge", !(await rpc(DESK, "reverse_tx", [vrTx, ""])).ok);
  const back = await rpc(VOL, "reverse_tx", [vrTx, "headset broke"]);
  ok("the VR volunteer reverses the charge → 398 again", back.ok && back.delta === 40 && (await coins(BEA)) === 398);
  ok("a reversal adds a row and keeps the original", (await one<{ n: number }>("select count(*)::int n from txs where user_id = $1 and ref like '%booth:vr'", [BEA])).n === 2 && !!(await one<{ reversed_at: string | null }>("select reversed_at from txs where id = $1", [vrTx])).reversed_at);
  ok("the same transaction can't be reversed twice", /Already reversed/.test((await rpc(ORG, "reverse_tx", [vrTx, ""])).error ?? "") && (await coins(BEA)) === 398);
  const rev = (await one<{ id: number }>("select id from txs where reverses = $1", [vrTx])).id;
  ok("a reversal can't itself be reversed", /can't be reversed/.test((await rpc(ORG, "reverse_tx", [rev, ""])).error ?? ""));
  let twin = false; try { await db.query("insert into txs (user_id, delta, reason, ref, reverses) values ($1, 40, 'again', 'reverse:booth:vr', $2)", [BEA, vrTx]); } catch { twin = true; }
  ok("the database itself refuses a second reversal row", twin);

  await as(BEA); await call("scan_booth", ["retro"]);
  ok("a volunteer can't reverse a charge at another booth", /own booth/.test((await rpc(VOL, "reverse_tx", [await txOf(BEA, "booth:retro"), ""])).error ?? ""));
  await db.query("update txs set at = now() - interval '1 minute' where user_id = $1", [BEA]); // past the double-scan guard
  await rpc(VOL, "staff_scan", [BEA, "vr"]);
  const oldVr = await txOf(BEA, "booth:vr");
  await db.query("update txs set at = now() - interval '16 minutes' where id = $1", [oldVr]);
  ok("a volunteer can't reverse after 15 minutes", /15 minutes/.test((await rpc(VOL, "reverse_tx", [oldVr, ""])).error ?? ""));
  ok("an admin still can", (await rpc(ORG, "reverse_tx", [oldVr, ""])).ok);

  const paid = await rpc(REC, "staff_scan", [BEA, "recharge-puzzle"]);
  const earned = async (id: string) => (await one<{ earned: number }>("select earned from profiles where id = $1", [id])).earned;
  ok("the puzzle volunteer pays Bea +20 once she passes", paid.ok && paid.delta === 20 && (await earned(BEA)) === 20);
  const before = await coins(BEA);
  ok("reversing a recharge payout takes the 20 back, and off the leaderboard", (await rpc(REC, "reverse_tx", [await txOf(BEA, "booth:recharge-puzzle"), "didn't finish"])).ok && (await coins(BEA)) === before - 20 && (await earned(BEA)) === 0);
  ok("…and the point stays used", !(await rpc(REC, "staff_scan", [BEA, "recharge-puzzle"])).ok && !(await rpc(BEA, "scan_booth", ["recharge-puzzle"])).ok);

  const stock = async () => (await one<{ stock: number }>("select stock from rewards where id = 'tee'")).stock;
  const s0 = await stock(); await as(BEA); await call("redeem_reward", ["tee"]);
  ok("an admin reverses a shop purchase: coins back, the tee back in stock", (await rpc(ORG, "reverse_tx", [await txOf(BEA, "reward:tee"), "wrong size"])).ok && (await stock()) === s0);
  await as(BEA); await call("redeem_reward", ["sticker-pack"]);
  ok("a volunteer can't reverse shop purchases", /own booth/.test((await rpc(VOL, "reverse_tx", [await txOf(BEA, "reward:sticker-pack"), ""])).error ?? ""));

  await rpc(ORG, "award_coins", [BEA, 100, "Quiz winner"]);
  const awardTx = await txOf(BEA, "admin");
  await db.query("update profiles set coins = 50 where id = $1", [BEA]); // she spent most of it
  ok("a reversal that would go below zero is refused", /already spent/.test((await rpc(ORG, "reverse_tx", [awardTx, ""])).error ?? "") && (await coins(BEA)) === 50);
  ok("a ticket reversal is refused once the coins are spent", !(await rpc(ORG, "reverse_tx", [await txOf(BEA, "ticket"), ""])).ok);

  ok("a wrong check-in: an admin reverses Cy's ticket → 0 coins, ticket pending", (await rpc(ORG, "reverse_tx", [await txOf(CY, "ticket"), "wrong person"])).ok && (await coins(CY)) === 0 && !(await one<{ ticket: boolean }>("select ticket from profiles where id = $1", [CY])).ticket);
  ok("…and the desk can verify the right person again", (await rpc(DESK, "issue_ticket", [CY, 398])).ok && (await coins(CY)) === 398 && !(await rpc(DESK, "issue_ticket", [CY, 398])).ok);

  ok("an attendee can't call the internal booth function to charge someone", !!(await asApi(BEA, "select booth_tx($1, 'vr', true)", [CY])).error);
  ok("…or write to the audit log", !!(await asApi(BEA, "select log_action('award', $1, null, 1000, 'x')", [BEA])).error);

  const find = async (uid: string, q: string) => (await asApi<{ handle: string; booth: string | null }>(uid, "select * from find_attendees($1)", [q])).rows;
  ok("staff find an attendee by part of a name", (await find(DESK, "bhat")).map((r) => r.handle).join() === "bea");
  ok("…by email, or by @handle", (await find(VOL, "BEA@gitam")).length === 1 && (await find(VOL, "@cy_99"))[0]?.handle === "cy_99");
  ok("a wildcard isn't a way to list everyone", (await find(VOL, "%%")).length === 0 && (await find(VOL, "_y")).length === 0);
  ok("attendees can't search", (await find(BEA, "bea")).length === 0);

  const seen = async (uid: string) => (await asApi<{ ref: string }>(uid, "select * from staff_txs($1)", [BEA])).rows.map((r) => r.ref);
  ok("a booth volunteer sees only their booth's lines of an attendee's ledger", (await seen(VOL)).length > 0 && (await seen(VOL)).every((r) => r.endsWith("booth:vr")));
  ok("a desk volunteer sees none; an admin sees all", (await seen(DESK)).length === 0 && (await seen(ORG)).includes("ticket"));

  const log = await db.query<{ actor_handle: string; action: string; target_handle: string | null; booth: string | null; amount: number | null }>("select actor_handle, action, target_handle, booth, amount from audit_log order by id");
  const has = (a: string, by: string, to: string | null, amount?: number) => log.rows.some((r) => r.action === a && r.actor_handle === by && r.target_handle === to && (amount === undefined || r.amount === amount));
  ok("the audit log records check-ins, scans, awards and reversals with who, whom and how much", has("ticket", "desk", "bea", 398) && has("scan", "vol", "bea", -40) && has("award", "org", "bea", 100) && has("reverse", "vol", "bea", 40) && has("reverse", "rec", "bea", -20));
  ok("…and role and booth changes", has("role", "org", "vol") && log.rows.some((r) => r.action === "booth" && r.target_handle === "vol" && r.booth === "vr"));
  ok("refused attempts leave no audit rows", !log.rows.some((r) => r.actor_handle === "bea" || (r.action === "award" && r.actor_handle === "vol")));
  ok("only admins read the audit log", (await asApi(VOL, "select * from audit_log")).rows.length === 0 && (await asApi(ORG, "select * from audit_log")).rows.length === log.rows.length);
  ok("nobody writes it directly", !!(await asApi(ORG, "insert into audit_log (actor_handle, action) values ('org', 'award')")).error);

  ok("taking a volunteer's role away takes them off their booth", (await role(ORG, "vol", "attendee"))?.ok === true && (await one<{ booth: string | null }>("select booth from profiles where id = $1", [VOL])).booth === null);
  ok("every balance still equals the sum of its ledger", (await one<{ n: number }>("select count(*)::int n from profiles p where coins <> coalesce((select sum(delta) from txs where user_id = p.id), 0) and id <> all($1)", [[ADA, BEA]])).n === 0); // (their balances were set by hand above)

  console.log(fails ? `\n${fails} FAILED` : "\nall schema checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
