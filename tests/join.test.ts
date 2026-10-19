/* Joining the club: name and email first, the GitHub username and first event later. The shared checks and the
   /api/join and /api/join/more endpoints (called directly, no server needed). */
import { validateJoin, validateMore } from "../lib/join";
import { CLUB } from "../lib/config";
import { tokenFor } from "../lib/email/token";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const EVENT = CLUB.events[0].date;
const good = { name: "Ada Lovelace", email: "ada@gitam.in" };
const req = (path: string, body: unknown, ip = "1.1.1.1") => new Request(`http://x${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

(async () => {
  process.env.EMAIL_SECRET = "test-secret";
  const { POST } = await import("../app/api/join/route");
  const { POST: MORE } = await import("../app/api/join/more/route");
  const post = (body: unknown, ip?: string) => POST(req("/api/join", body, ip));

  // ---- step 1: a name and an email ----
  ok("a name and an email is a complete sign-up", validateJoin(good) === null);
  ok("no GitHub username or event is needed to join", validateJoin({ name: "Ada", email: "ada@gitam.in" }) === null);
  ok("a one-letter name or a bad email is refused, with a friendly reason", validateJoin({ ...good, name: "A" }) === "What should we call you?" && validateJoin({ ...good, email: "ada@" }) !== null);
  ok("a filled honeypot is spam", validateJoin({ ...good, website: "http://spam" }) === "spam");
  ok("a browser that fills both fields and a person who presses Join at once is a person, not a bot (timing is no longer a test)", validateJoin({ ...good, elapsedMs: 5 } as never) === null && validateJoin(good) === null);

  // ---- step 2: the optional extras ----
  const t = tokenFor("ada@gitam.in");
  ok("a GitHub username, an event, or both can be added", validateMore({ email: "ada@gitam.in", token: t, handle: "@ada" }) === null && validateMore({ email: "ada@gitam.in", token: t, firstEvent: EVENT }) === null);
  ok("…but not a made-up username or an event that isn't on the calendar", validateMore({ email: "ada@gitam.in", token: t, handle: "-bad-" }) !== null && validateMore({ email: "ada@gitam.in", token: t, firstEvent: "2030-01-01" }) !== null);
  ok("an empty second step says what's missing", (validateMore({ email: "ada@gitam.in", token: t }) ?? "").startsWith("Add your GitHub username"));

  // ---- the endpoints ----
  let r = await post({ ...good, email: "nope" }, "2.2.2.2");
  ok("joining with invalid input is a 422", r.status === 422 && (await r.json()).ok === false);
  r = await post({ ...good, website: "x" }, "3.3.3.3");
  const sp = await r.json();
  ok("spam is quietly accepted (and dropped), with no key, so a page never shows you are in for it", r.status === 200 && sp.ok === true && !sp.token);
  r = await post(good, "4.4.4.4");
  ok("without a database the form is asked to fall back", r.status === 503 && (await r.json()).fallback === true);
  let last = 0; for (let i = 0; i < 6; i++) last = (await post(good, "5.5.5.5")).status;
  ok("the 6th sign-up from one IP in 10 minutes is rate-limited", last === 429);
  ok("malformed JSON is a 400", (await POST(new Request("http://x/api/join", { method: "POST", body: "not json" }))).status === 400);
  r = await MORE(req("/api/join/more", { email: "ada@gitam.in", token: tokenFor("bob@gitam.in"), handle: "ada" }, "6.6.6.6"));
  ok("the extras need the key made for that email: someone else's key is refused (403)", r.status === 403);
  r = await MORE(req("/api/join/more", { email: "ada@gitam.in", token: t, handle: "ada" }, "6.6.6.7"));
  ok("with the right key and no database, it says so (503)", r.status === 503);

  console.log(fails ? `\n${fails} FAILED` : "\nall join checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e); process.exit(1); });
