/* Core-team applications: the shared validator and /api/apply against a fake database. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { cleanAnswers, validateApplication } from "../lib/apply";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const calls: { path: string; key: string; body: Record<string, unknown> }[] = []; let open: unknown = { id: 7, name: "Core team 2026-27", closes_on: "2026-11-30" }; let answer: unknown = "created"; let down = false;
const fake = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const reply = (status: number, json: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(json)); };
  if (req.url?.startsWith("/rest/v1/rpc/open_campaign")) return reply(200, open);
  if (req.url?.startsWith("/rest/v1/rpc/submit_application")) { calls.push({ path: req.url, key: String(req.headers.apikey), body: JSON.parse(b) }); return down ? reply(500, {}) : reply(200, answer); }
  reply(404, {});
}); });
const post = (body: unknown, ip: string) => new Request("http://x/api/apply", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const good = { campaign: 7, name: " Pia Nair ", email: " Pia@Gitam.in ", handle: "@pia-n", team: "Design", answers: { why: "I want to help run events and learn how clubs work.", built: " a small site " }, elapsedMs: 20_000 };

(async () => {
  ok("a complete application is valid", validateApplication(good) === null);
  ok("the team is optional, but must be one of ours", validateApplication({ ...good, team: "" }) === null && validateApplication({ ...good, team: "Hackers" }) !== null);
  ok("a GitHub username is required and must be real", validateApplication({ ...good, handle: "" }) !== null && validateApplication({ ...good, handle: "-bad-" }) !== null);
  ok("a bad email, a one-letter name and a short 'why' are refused", validateApplication({ ...good, email: "pia@" }) !== null && validateApplication({ ...good, name: "P" }) !== null && validateApplication({ ...good, answers: { why: "ok" } }) !== null);
  ok("each answer stops at 1000 characters; unknown questions are refused", validateApplication({ ...good, answers: { why: "x".repeat(1001) } }) !== null && validateApplication({ ...good, answers: { why: "A".repeat(30), phone: "123" } }) !== null);
  ok("the honeypot and an instant submit are spam", validateApplication({ ...good, website: "x" }) === "spam" && validateApplication({ ...good, elapsedMs: 100 }) === "spam");
  ok("answers are trimmed and empty ones dropped", JSON.stringify(cleanAnswers({ why: " hi there friend ", built: "  " })) === JSON.stringify({ why: "hi there friend" }));

  const port = await new Promise<number>((r) => fake.listen(0, "127.0.0.1", () => r((fake.address() as AddressInfo).port)));
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { GET, POST } = await import("../app/api/apply/route");
  ok("without a database: no round is open, and applying says so", (await (await GET()).json()).open === false && (await POST(post(good, "1.1.1.1"))).status === 503);

  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "server-only-key" });
  const g = await (await GET()).json();
  ok("when a round is open, the page learns its id, name and closing date", g.open === true && g.campaign.id === 7 && g.campaign.closesOn === "2026-11-30");
  open = null; ok("when none is open, the page is told so", (await (await GET()).json()).open === false); open = { id: 7, name: "Core team 2026-27", closes_on: "2026-11-30" };

  let r = await POST(post(good, "2.2.2.2"));
  ok("a valid application is saved (201) through submit_application with the server key", r.status === 201 && calls.length === 1 && calls[0].key === "server-only-key" && calls[0].path.includes("rpc/submit_application"));
  ok("it sends clean values: lower-case email, handle without @, trimmed answers", calls[0].body.p_email === "pia@gitam.in" && calls[0].body.p_handle === "pia-n" && calls[0].body.p_name === "Pia Nair" && JSON.stringify(calls[0].body.p_answers) === JSON.stringify({ why: "I want to help run events and learn how clubs work.", built: "a small site" }) && calls[0].body.p_campaign === 7);
  answer = "exists"; r = await POST(post(good, "2.2.2.3")); ok("a second application with the same email says 'exists' (200)", r.status === 200 && (await r.json()).status === "exists");
  answer = "closed"; r = await POST(post(good, "2.2.2.4")); const j = await r.json(); ok("a closed round is a 409 and the form is told", r.status === 409 && j.closed === true);
  answer = "busy"; r = await POST(post(good, "2.2.2.5")); ok("the database's hourly backstop is a 429", r.status === 429);
  answer = "created"; down = true; r = await POST(post(good, "2.2.2.6")); down = false; ok("a database error is a 502", r.status === 502);
  const n = calls.length; r = await POST(post({ ...good, website: "http://spam" }, "3.3.3.3"));
  ok("spam gets a quiet 200 and is not saved", r.status === 200 && calls.length === n);
  r = await POST(post({ ...good, email: "nope" }, "3.3.3.4")); ok("invalid input is a 422 with a message", r.status === 422 && typeof (await r.json()).error === "string");
  ok("malformed JSON is a 400", (await POST(new Request("http://x/api/apply", { method: "POST", body: "not json" }))).status === 400);
  let last = 0; for (let i = 0; i < 7; i++) last = (await POST(post(good, "4.4.4.4"))).status;
  ok("the 6th try from one IP in 10 minutes is rate-limited (429)", last === 429);

  console.log(fails ? `\n${fails} FAILED` : "\nall apply checks passed"); fake.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e); process.exit(1); });
