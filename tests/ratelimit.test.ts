/* The form rate limit: the shared counter in the database, and the per-server fallback when it's missing or slow. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { clientIp, limited, rateLimited, visitorKey } from "../lib/ratelimit";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const calls: Record<string, unknown>[] = []; let mode: "allow" | "block" | "down" | "slow" = "allow";
const fake = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  if (req.url?.startsWith("/rest/v1/rpc/rate_hit") && req.method === "POST") {
    calls.push(JSON.parse(b));
    if (mode === "down") { res.writeHead(500); return res.end("{}"); }
    const answer = () => { res.writeHead(200, { "content-type": "application/json" }); res.end(mode === "block" ? "false" : "true"); };
    return mode === "slow" ? void setTimeout(answer, 3000) : answer();
  }
  res.writeHead(404); res.end();
}); });
const req = (ip: string) => new Request("http://x/api/join", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

(async () => {
  const port = await new Promise<number>((r) => fake.listen(0, "127.0.0.1", () => r((fake.address() as AddressInfo).port)));

  ok("the visitor's IP is the first address Vercel forwards", clientIp(req("1.2.3.4")) === "1.2.3.4");
  const k = visitorKey("join", "1.2.3.4", "salt");
  ok("the key never contains the IP", !k.includes("1.2.3.4") && k.startsWith("join:"));
  ok("the key is the same for the same visitor and form", k === visitorKey("join", "1.2.3.4", "salt"));
  ok("…and differs per form, per visitor and per salt", k !== visitorKey("contact", "1.2.3.4", "salt") && k !== visitorKey("join", "1.2.3.5", "salt") && k !== visitorKey("join", "1.2.3.4", "other"));
  ok("the key fits the database's 100-character limit", visitorKey("feedback", "2001:db8::1".repeat(5)).length <= 100);

  const t = 1_000_000;
  ok("in memory: 5 hits pass, the 6th is blocked", [1, 2, 3, 4, 5, 6].map((i) => limited("mem", 5, 600_000, t + i)).join() === "false,false,false,false,false,true");
  ok("in memory: after the window, it lets the visitor in again", limited("mem", 5, 600_000, t + 600_010) === false);

  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const six = async (ip: string) => { const r: boolean[] = []; for (let i = 0; i < 6; i++) r.push(await rateLimited(req(ip), "join", 5)); return r.join(); };
  ok("without Supabase: the per-server limiter blocks the 6th sign-up", (await six("3.3.3.3")) === "false,false,false,false,false,true");

  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
  ok("with Supabase: the database decides (allowed)", (await rateLimited(req("4.4.4.4"), "contact", 5)) === false);
  const sent = calls.at(-1)!;
  ok("…it sends a hashed key, the limit and the window in seconds", typeof sent.p_key === "string" && !String(sent.p_key).includes("4.4.4.4") && sent.p_limit === 5 && sent.p_window_seconds === 600);
  mode = "block";
  ok("with Supabase: the database decides (blocked)", (await rateLimited(req("4.4.4.4"), "contact", 5)) === true);
  mode = "down";
  ok("if the database errors, the per-server limiter takes over", (await six("5.5.5.5")) === "false,false,false,false,false,true");
  mode = "slow"; const t0 = Date.now();
  ok("if the database is slow, the form doesn't wait for it", (await rateLimited(req("6.6.6.6"), "join", 5)) === false && Date.now() - t0 < 2500);

  fake.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall rate-limit checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e.message); process.exit(1); });
