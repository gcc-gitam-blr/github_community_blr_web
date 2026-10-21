/* A stand-in database for the browser tests of the public forms (tests/e2e/forms.spec.ts).
   It runs the REAL supabase/schema.sql in PGlite (Postgres in memory) and answers the site's server the way Supabase does
   for the calls the public forms make: POST /rest/v1/rpc/<function> with named arguments, as the server key. So a form
   test runs the whole real path: the page, the API route, the SQL function, and back. Nothing here touches a real database.
   Test-only extras: GET /__health, POST /__sql {q, params} to look at or seed the tables, POST /__reset to empty them. */
import http from "node:http";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import { AUTH_USERS } from "../auth-stub";
const PORT = Number(process.env.FAKE_SUPABASE_PORT) || 54329;
const SQL = fs.readFileSync("supabase/schema.sql", "utf8");
const db = new PGlite();

async function setup() {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    ${AUTH_USERS}
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create publication supabase_realtime;
  `);
  await db.exec(SQL);
  await db.exec("grant usage on schema public to anon, authenticated, service_role; grant select, insert, update, delete on all tables in schema public to service_role;");
  await db.exec(SQL); // safe to run again, as the live database is: the second run is what a re-run after an update does
}

// a function's argument names and types, to call it with named arguments exactly as PostgREST does
const sig = new Map<string, Map<string, string>>();
async function argTypes(fn: string) {
  if (!sig.has(fn)) {
    const r = await db.query<{ names: string[] | null; types: string[] }>(
      `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`, [fn]);
    if (!r.rows.length) return null;
    const m = new Map<string, string>(); (r.rows[0].names ?? []).forEach((n, i) => m.set(n, r.rows[0].types[i]));
    sig.set(fn, m);
  }
  return sig.get(fn)!;
}

async function rpc(fn: string, args: Record<string, unknown>) {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error("bad function name");
  const types = await argTypes(fn);
  if (!types) return { status: 404, body: { message: `function ${fn} not found` } };
  const keys = Object.keys(args), params: unknown[] = [];
  const list = keys.map((k, i) => {
    const t = types.get(k); if (!t) throw new Error(`unknown argument ${k}`);
    const v = args[k]; params.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v);
    return `${k} => $${i + 1}::${t}`;
  });
  await db.exec("set role service_role");
  try {
    const r = await db.query<{ r: unknown }>(`select public.${fn}(${list.join(", ")}) as r`, params);
    return { status: 200, body: r.rows[0]?.r ?? null };
  } catch (e) {
    return { status: 400, body: { message: (e as Error).message } };
  } finally { await db.exec("reset role"); }
}

const TABLES = ["join_requests", "messages", "event_feedback", "epoch_interest", "applications", "rate_hits", "recruitment_campaigns", "crm_audit"];

setup().then(() => {
  http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      const send = (status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
      try {
        const url = new URL(req.url ?? "/", "http://x"), body = raw ? JSON.parse(raw) : {};
        if (url.pathname === "/__health") return send(200, { ok: true });
        if (url.pathname === "/__sql") return send(200, (await db.query(body.q, body.params ?? [])).rows);
        if (url.pathname === "/__reset") {
          await db.exec("alter table crm_audit disable trigger crm_audit_readonly");
          await db.exec(`truncate ${TABLES.join(", ")} restart identity cascade`);
          await db.exec("alter table crm_audit enable trigger crm_audit_readonly");
          return send(200, { ok: true });
        }
        const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
        if (m && req.method === "POST") { const r = await rpc(m[1], body); return send(r.status, r.body); }
        send(404, { message: `not in the stand-in: ${req.method} ${url.pathname}` });
      } catch (e) { send(500, { message: (e as Error).message }); }
    });
  }).listen(PORT, "127.0.0.1", () => console.log(`stand-in database (schema.sql in PGlite) on ${PORT}`));
});
