/* Anonymous event feedback: validator and /api/feedback against a fake database. */
import http from "node:http";
import type { AddressInfo } from "node:net";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const saved: Record<string, unknown>[] = []; let down = false;
const fake = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  if (req.url?.startsWith("/rest/v1/event_feedback") && req.method === "POST") { if (down) { res.writeHead(500); return res.end("{}"); } saved.push(JSON.parse(b)); res.writeHead(201); return res.end(); }
  res.writeHead(404); res.end();
}); });
const post = (body: unknown, ip: string) => new Request("http://x/api/feedback", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

(async () => {
  const dbPort = await new Promise<number>((r) => fake.listen(0, "127.0.0.1", () => r((fake.address() as AddressInfo).port)));
  const { validateFeedback } = await import("../lib/feedback");
  const good = { event: "2026-10-07", rating: 5, liked: "Mentors were great", improve: "More time", elapsedMs: 5000 };

  ok("a normal submission is valid", validateFeedback(good) === null);
  ok("liked/improve are optional", validateFeedback({ event: "2026-10-12", rating: 3, elapsedMs: 5000 }) === null);
  ok("rating 0 and 6 are rejected", validateFeedback({ ...good, rating: 0 }) !== null && validateFeedback({ ...good, rating: 6 }) !== null);
  ok("a half-star is rejected", validateFeedback({ ...good, rating: 4.5 }) !== null);
  ok("an event that doesn't exist is rejected", validateFeedback({ ...good, event: "2030-01-01" }) !== null);
  ok("a 1001-character answer is rejected", validateFeedback({ ...good, liked: "x".repeat(1001) }) !== null);
  ok("the honeypot marks spam", validateFeedback({ ...good, website: "x" }) === "spam");

  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${dbPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
  const { POST } = await import("../app/api/feedback/route");
  let r = await POST(post(good, "1.1.1.1"));
  ok("a valid submission is saved (201)", r.status === 201 && saved.length === 1 && saved[0].rating === 5 && saved[0].event === "2026-10-07");
  ok("it stores no name, email or IP — only the answers", Object.keys(saved[0]).sort().join() === "event,improve,liked,rating");
  r = await POST(post({ ...good, liked: "  ", improve: "" }, "1.1.1.2"));
  ok("blank answers are stored as null", saved[1].liked === null && saved[1].improve === null);
  r = await POST(post({ ...good, rating: 9 }, "1.1.1.3"));
  ok("invalid input is a 422", r.status === 422);
  const n = saved.length; r = await POST(post({ ...good, website: "x" }, "1.1.1.4"));
  ok("spam is accepted quietly and not saved", r.status === 200 && saved.length === n);
  down = true; r = await POST(post(good, "1.1.1.5")); down = false;
  ok("a database error is a 502", r.status === 502);
  let last = 0; for (let i = 0; i < 14; i++) last = (await POST(post(good, "2.2.2.2"))).status;
  ok("the 13th submission from one IP in 10 minutes is rate-limited", last === 429);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  r = await POST(post(good, "3.3.3.3"));
  ok("with no database it says so (503)", r.status === 503);
  console.log(fails ? `\n${fails} FAILED` : "\nall feedback checks passed"); fake.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e); process.exit(1); });
