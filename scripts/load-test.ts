/* npm run load-test — 300 phones at Epoch at the same time, against a real Postgres in Docker (never the live database).

   Runs supabase/schema.sql in a throwaway postgres:17 container, then plays the day:
     1. doors open:   every phone signs up at once
     2. check-in:     six desks verify tickets, and sometimes two desks scan the same person at the same moment
     3. booth rush:   every phone scans booths, recharge points and the shop at once, including double-taps
   then checks the money still adds up, and reports how long each call took.

   It measures the database's coin logic under real concurrency (locks, races, double-spends). It doesn't measure
   Supabase's network or the size of its free-tier machine, so real latencies will be higher than these.
   Options: PHONES=300 POOL=20 (connections, like Supabase's API pool) KEEP=1 (leave the container running). Needs Docker. */
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const PHONES = Number(process.env.PHONES ?? 300), POOL = Number(process.env.POOL ?? 20), ACTIONS = 12, DESKS = 6;
const NAME = "epoch-load-test", PORT = 55432;
const sh = (cmd: string) => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

type R = { ok: boolean; error?: string; delta?: number; balance?: number };
const timings = new Map<string, number[]>();
const outcomes = new Map<string, number>();
const crashes: string[] = [];
const count = (k: string) => outcomes.set(k, (outcomes.get(k) ?? 0) + 1);

let pool: pg.Pool;

/** One call as the API makes it: a transaction that sets who's signed in, then the function. Timed from the phone's side (pool wait included). */
async function rpc(uid: string, fn: string, args: unknown[]): Promise<R | null> {
  const t = performance.now();
  try {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('test.uid', $1, true)", [uid]);
      const { rows } = await c.query(`select ${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args);
      await c.query("commit");
      const r = (fn === "register_profile" ? { ok: true } : rows[0].r) as R;
      count(`${fn}: ${r.ok ? "ok" : r.error?.replace(/^.* already has a verified ticket\.$/, "already verified").replace(/^You've already used .*$/, "recharge already used")}`);
      return r;
    } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
  } catch (e) {
    crashes.push(`${fn}: ${(e as Error).message}`); return null;
  } finally {
    const ms = performance.now() - t;
    (timings.get(fn) ?? timings.set(fn, []).get(fn)!).push(ms);
  }
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };

async function main() {
  try { sh("docker info --format {{.ServerVersion}}"); } catch { console.error("Docker isn't running. Start Docker Desktop and try again."); process.exit(1); }
  try { sh(`docker rm -f ${NAME}`); } catch { /* none left over */ }
  console.log(`starting postgres:17 in Docker (${NAME}, port ${PORT})…`);
  sh(`docker run -d --rm --name ${NAME} -e POSTGRES_PASSWORD=load -p ${PORT}:5432 postgres:17-alpine -c max_connections=200`);
  pool = new pg.Pool({ host: "127.0.0.1", port: PORT, user: "postgres", password: "load", database: "postgres", max: POOL });
  for (let i = 0; ; i++) { try { await pool.query("select 1"); break; } catch { if (i > 60) throw new Error("postgres didn't start"); await sleep(1000); } }

  // Supabase's auth schema, stubbed as in tests/schema.test.ts: auth.uid() reads a per-transaction setting
  const phones = Array.from({ length: PHONES }, () => randomUUID()), desks = Array.from({ length: DESKS }, () => randomUUID());
  await pool.query(`
    create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;`);
  await pool.query(fs.readFileSync("supabase/schema.sql", "utf8"));
  await pool.query(`insert into auth.users select id, 'user' || n || '@gitam.in', jsonb_build_object('user_name', 'user' || n) from unnest($1::uuid[]) with ordinality as t(id, n)`, [[...phones, ...desks]]);
  const spend = (await pool.query<{ id: string }>("select id from booths where kind = 'spend'")).rows.map((r) => r.id);
  const recharge = (await pool.query<{ id: string }>("select id from booths where kind = 'recharge'")).rows.map((r) => r.id);
  const rewards = (await pool.query<{ id: string; stock: number }>("select id, stock from rewards")).rows;
  console.log(`${PHONES} phones, ${DESKS} desks, ${POOL} connections · ${spend.length} spend booths, ${recharge.length} recharge points, ${rewards.length} shop items\n`);

  const t0 = performance.now();
  // 1. doors open
  await Promise.all([...phones, ...desks].map((u, i) => rpc(u, "register_profile", [`Person ${i}`])));
  await pool.query("update profiles set role = 'volunteer' where id = any($1)", [desks]);
  const t1 = performance.now();

  // 2. check-in: every ticket verified once; 10% of people get scanned by two desks at the same moment
  const doubles: [R | null, R | null][] = [];
  await Promise.all(phones.map(async (p) => {
    if (Math.random() < 0.1) doubles.push(await Promise.all([rpc(pick(desks), "issue_ticket", [p, 398]), rpc(pick(desks), "issue_ticket", [p, 398])]));
    else await rpc(pick(desks), "issue_ticket", [p, 398]);
  }));
  const t2 = performance.now();

  // 3. booth rush: every phone at once, a dozen actions each, with double-taps
  const taps: [R | null, R | null][] = [];
  await Promise.all(phones.map(async (p) => {
    for (let i = 0; i < ACTIONS; i++) {
      await sleep(Math.random() * 100); // walking between booths, compressed
      const x = Math.random();
      if (x < 0.55) await rpc(p, "scan_booth", [pick(spend)]);
      else if (x < 0.75) await rpc(p, "scan_booth", [pick(recharge)]);
      else if (x < 0.85) { const b = pick(spend); taps.push(await Promise.all([rpc(p, "scan_booth", [b]), rpc(p, "scan_booth", [b])])); }
      else await rpc(p, "redeem_reward", [pick(rewards).id]);
    }
  }));
  const t3 = performance.now();

  // the money must still add up
  const checks: [string, boolean][] = [];
  const q = async (sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows;
  checks.push(["every balance equals the sum of that person's transactions", (await q("select count(*)::int n from profiles p where coins <> coalesce((select sum(delta) from txs where user_id = p.id), 0)"))[0].n === 0]);
  checks.push(["nobody's balance went below zero", (await q("select count(*)::int n from profiles where coins < 0"))[0].n === 0]);
  checks.push(["every phone's ticket was credited exactly once", (await q("select count(*)::int n from profiles p where id = any($1) and (select count(*) from txs where user_id = p.id and ref = 'ticket') <> 1", [phones]))[0].n === 0]);
  checks.push(["two desks scanning the same person at once credit them once", doubles.every(([a, b]) => [a, b].filter((r) => r?.ok).length === 1)]);
  checks.push(["each recharge point paid each person at most once", (await q("select count(*)::int n from (select user_id, ref from txs where ref like 'booth:recharge-%' group by 1, 2 having count(*) > 1) d"))[0].n === 0]);
  checks.push(["a double-tap never charges twice", taps.every(([a, b]) => [a, b].filter((r) => r?.ok).length <= 1)]);
  checks.push(["no booth charged the same person twice within 20 seconds", (await q("select count(*)::int n from txs a join txs b on a.user_id = b.user_id and a.ref = b.ref and a.id < b.id and b.at - a.at < interval '20 seconds' where a.ref like 'booth:%' and a.ref not like 'booth:recharge-%'"))[0].n === 0]);
  const stock = await q("select id, stock, (select count(*)::int from txs where ref = 'reward:' || r.id) sold from rewards r");
  checks.push(["shop stock matches what was sold, and never went negative", stock.every((s) => s.stock >= 0 && s.stock + s.sold === rewards.find((r) => r.id === s.id)!.stock)]);
  checks.push(["no call failed with a database error (deadlock, timeout, crash)", crashes.length === 0]);

  const calls = [...timings.values()].reduce((n, xs) => n + xs.length, 0);
  console.log(`phases: sign-up ${((t1 - t0) / 1000).toFixed(1)} s · check-in ${((t2 - t1) / 1000).toFixed(1)} s · booth rush ${((t3 - t2) / 1000).toFixed(1)} s`);
  console.log(`${calls} calls in ${((t3 - t0) / 1000).toFixed(1)} s (${Math.round(calls / ((t3 - t0) / 1000))} calls/s)\n`);
  console.log("call               count    p50     p95     p99     max   (ms, from the phone's side)");
  for (const [fn, xs] of timings) console.log(`${fn.padEnd(18)} ${String(xs.length).padStart(5)} ${[50, 95, 99, 100].map((p) => pct(xs, p).toFixed(0).padStart(7)).join("")}`);
  console.log("\noutcomes (refusals are the coin rules working):");
  for (const [k, n] of [...outcomes].sort()) console.log(`  ${String(n).padStart(5)}  ${k}`);
  console.log("\nsold:", stock.map((s) => `${s.id} ${s.sold}`).join(" · "));
  console.log("");
  for (const [name, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (crashes.length) console.log("\nfirst errors:\n  " + [...new Set(crashes)].slice(0, 5).join("\n  "));
  return checks.every(([, pass]) => pass);
}

main()
  .then(async (passed) => { await pool?.end(); if (!process.env.KEEP) sh(`docker rm -f ${NAME}`); process.exit(passed ? 0 : 1); })
  .catch(async (e) => { console.error(e); await pool?.end().catch(() => {}); try { if (!process.env.KEEP) sh(`docker rm -f ${NAME}`); } catch {} process.exit(1); });
