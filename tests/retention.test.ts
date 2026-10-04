/* The weekly clean-up: only Vercel's cron (with CRON_SECRET) can start it, and /privacy quotes the real periods. */
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { cronAuthorized } from "../lib/cron";
import { RETENTION } from "../lib/retention";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
let calls = 0, down = false;
const fake = http.createServer((req, res) => { req.resume(); req.on("end", () => {
  if (req.url?.startsWith("/rest/v1/rpc/prune_old_data")) { calls++; if (down) { res.writeHead(500); return res.end("{}"); } res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ signups: 2, messages: 0, feedback: 1, errors: 9 })); }
  res.writeHead(404); res.end();
}); });
const get = (auth?: string) => new Request("http://x/api/cron/retention", { headers: auth ? { authorization: auth } : {} });

(async () => {
  ok("the right secret is accepted", cronAuthorized("Bearer s3cret", "s3cret"));
  ok("a wrong or missing secret is refused", !cronAuthorized("Bearer nope", "s3cret") && !cronAuthorized(null, "s3cret") && !cronAuthorized("s3cret", "s3cret"));
  ok("with no CRON_SECRET set, nothing is accepted", !cronAuthorized("Bearer ", "") && !cronAuthorized("Bearer undefined", undefined));

  const { GET } = await import("../app/api/cron/retention/route");
  delete process.env.CRON_SECRET; delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  ok("without CRON_SECRET the job refuses to run (503)", (await GET(get("Bearer x"))).status === 503);
  process.env.CRON_SECRET = "s3cret";
  ok("a request without the secret is refused (401)", (await GET(get())).status === 401);
  ok("a request with the wrong secret is refused (401)", (await GET(get("Bearer guess"))).status === 401);
  let r = await GET(get("Bearer s3cret"));
  ok("without a database it skips cleanly", r.status === 200 && !!(await r.json()).skipped);

  const port = await new Promise<number>((res) => fake.listen(0, "127.0.0.1", () => res((fake.address() as AddressInfo).port)));
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
  r = await GET(get("Bearer s3cret"));
  ok("with the secret it runs prune_old_data and reports what it deleted", r.status === 200 && calls === 1 && (await r.json()).deleted.errors === 9);
  ok("the wrong secret never reaches the database", (await GET(get("Bearer guess"))).status === 401 && calls === 1);
  down = true;
  ok("a database error is a 502, so the failure shows in Vercel's logs", (await GET(get("Bearer s3cret"))).status === 502);

  const cron = JSON.parse(fs.readFileSync("vercel.json", "utf8")).crons ?? [];
  ok("vercel.json runs it once a week", cron.some((c: { path: string; schedule: string }) => c.path === "/api/cron/retention" && /^\d+ \d+ \* \* \d$/.test(c.schedule)));
  const privacy = fs.readFileSync("app/privacy/page.tsx", "utf8");
  ok("/privacy takes its periods from lib/retention.ts", privacy.includes("RETENTION.signUpsMonths") && privacy.includes("RETENTION.messagesMonths") && privacy.includes("RETENTION.feedbackMonths") && privacy.includes("RETENTION.errorsDays"));
  ok("the periods are sensible", RETENTION.signUpsMonths >= 12 && RETENTION.errorsDays <= 90);

  fake.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall retention checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
