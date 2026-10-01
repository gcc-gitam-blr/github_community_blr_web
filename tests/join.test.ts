/* Club sign-up: the shared validator and the /api/join endpoint (called directly, no server needed). */
import { MIN_FILL_MS, validateJoin } from "../lib/join";
import { POST } from "../app/api/join/route";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const EVENT = "2026-10-07";
const good = { handle: "ada", email: "ada@gitam.in", firstEvent: EVENT, elapsedMs: 10_000 };
const post = (body: unknown, ip = "1.1.1.1") => POST(new Request("http://x/api/join", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));

(async () => {
  ok("a normal sign-up is valid", validateJoin(good) === null);
  ok("a leading @ on the handle is fine", validateJoin({ ...good, handle: "@ada" }) === null);
  ok("an invalid GitHub handle is rejected", validateJoin({ ...good, handle: "-bad-" }) !== null);
  ok("a handle longer than 39 characters is rejected", validateJoin({ ...good, handle: "a".repeat(40) }) !== null);
  ok("a bad email is rejected", validateJoin({ ...good, email: "ada@" }) !== null);
  ok("an event that isn't on the calendar is rejected", validateJoin({ ...good, firstEvent: "2030-01-01" }) !== null);
  ok("a filled honeypot is flagged as spam", validateJoin({ ...good, website: "http://spam" }) === "spam");
  ok(`a form filled in under ${MIN_FILL_MS} ms is flagged as spam`, validateJoin({ ...good, elapsedMs: 200 }) === "spam");

  let r = await post({ ...good, email: "nope" }, "2.2.2.2");
  ok("endpoint rejects invalid input with 422", r.status === 422 && (await r.json()).ok === false);
  r = await post({ ...good, website: "x" }, "3.3.3.3");
  ok("endpoint quietly accepts (and drops) spam", r.status === 200 && (await r.json()).ok === true);
  r = await post(good, "4.4.4.4");
  const j = await r.json();
  ok("without a database it asks the form to fall back", r.status === 503 && j.fallback === true);
  let last = 0; for (let i = 0; i < 6; i++) last = (await post(good, "5.5.5.5")).status;
  ok("the 6th sign-up from one IP in 10 minutes is rate-limited", last === 429);
  r = await POST(new Request("http://x/api/join", { method: "POST", body: "not json" }));
  ok("malformed JSON gets a 400", r.status === 400);

  console.log(fails ? `\n${fails} FAILED` : "\nall join checks passed"); process.exit(fails ? 1 : 0);
})();
