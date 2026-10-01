/* Email, end to end, with no external services:
   - a real SMTP server on localhost receives the mail that nodemailer actually sends
   - a tiny fake Supabase (HTTP) stands in for the database and its login check
   - the real route handlers (/api/join, /api/broadcast, /api/unsubscribe) are called directly. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";
import { simpleParser, type ParsedMail } from "mailparser";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

// ---- fake SMTP inbox ----
const inbox: ParsedMail[] = [];
const smtp = new SMTPServer({
  authOptional: false, disabledCommands: ["STARTTLS"], allowInsecureAuth: true,
  onAuth: (a, _s, cb) => (a.username === "club@test" && a.password === "app-password" ? cb(null, { user: 1 }) : cb(new Error("bad login"))),
  onData(stream, _s, cb) { simpleParser(stream).then((m) => { inbox.push(m); cb(); }).catch(cb); },
});

// ---- fake Supabase ----
const db = { joins: [] as { email: string; unsubscribed: boolean }[], role: "admin", unsub: [] as string[], broadcasts: [] as unknown[] };
const fake = http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
    const url = req.url ?? ""; const send = (s: number, j: unknown) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(j)); };
    if (url.startsWith("/auth/v1/user")) return send(200, { id: "11111111-1111-1111-1111-111111111111", email: "admin@test", aud: "authenticated", role: "authenticated" });
    if (url.startsWith("/rest/v1/rpc/my_role")) return send(200, db.role);
    if (url.startsWith("/rest/v1/rpc/unsubscribe_join")) { db.unsub.push(JSON.parse(body).p_email); return send(200, null); }
    if (url.startsWith("/rest/v1/join_requests") && req.method === "POST") {
      const row = JSON.parse(body);
      if (db.joins.some((j) => j.email === row.email)) return send(409, { code: "23505", message: "duplicate" });
      db.joins.push({ email: row.email, unsubscribed: false }); return send(201, null);
    }
    if (url.startsWith("/rest/v1/join_requests")) return send(200, db.joins.filter((j) => !j.unsubscribed).map((j) => ({ email: j.email })));
    if (url.startsWith("/rest/v1/broadcasts")) { db.broadcasts.push(JSON.parse(body)); return send(201, null); }
    send(404, { message: "not found " + url });
  });
});
const listen = (s: { listen: (p: number, h: string, cb: () => void) => unknown; address?: () => unknown }) => new Promise<number>((r) => { (s as unknown as http.Server).listen(0, "127.0.0.1", () => r(((s as unknown as http.Server).address() as AddressInfo).port)); });

const postJson = (url: string, body: unknown, headers: Record<string, string> = {}) => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const raw = (m: ParsedMail, name: string) => m.headerLines.find((h) => h.key === name)?.line.split(":").slice(1).join(":").trim() ?? "";
const toOf = (m: ParsedMail) => (m.to && !Array.isArray(m.to) ? m.to.text : "");
const settle = () => new Promise((r) => setTimeout(r, 300));

(async () => {
  const smtpPort = await new Promise<number>((r) => smtp.listen(0, "127.0.0.1", () => r((smtp.server.address() as AddressInfo).port)));
  const dbPort = await listen(fake);

  process.env.EMAIL_SECRET = "test-secret"; process.env.NEXT_PUBLIC_SITE_URL = "https://club.test";
  const { welcomeEmail, broadcastEmail, esc } = await import("../lib/email/templates");
  const { tokenFor, verifyToken, unsubscribeUrl } = await import("../lib/email/token");
  const { sendEmail, emailConfigured } = await import("../lib/email/send");

  // --- templates ---
  const w = welcomeEmail({ handle: "<script>alert(1)</script>", site: "https://club.test", unsubscribe: "https://club.test/unsubscribe?x" });
  ok("welcome email escapes anything a person typed", !w.html.includes("<script>") && w.html.includes("&lt;script&gt;"));
  ok("welcome email carries the WhatsApp link and an unsubscribe link", w.html.includes("chat.whatsapp.com") && w.text.includes("Unsubscribe: https://club.test/unsubscribe"));
  const b = broadcastEmail({ subject: "Hi <b>", message: "First line\nsecond line\n\nSee https://example.com/x now", site: "https://club.test", unsubscribe: "u" });
  ok("broadcast turns blank lines into paragraphs and URLs into links", (b.html.match(/<p>/g) ?? []).length >= 2 && b.html.includes('<a href="https://example.com/x"') && b.html.includes("Hi &lt;b&gt;"));
  ok("esc handles quotes and ampersands", esc(`a&b"c'd`) === "a&amp;b&quot;c&#39;d");

  // --- tokens ---
  const t = tokenFor("Ada@Gitam.in");
  ok("a token verifies for the same address, in any letter case", verifyToken("ada@gitam.in", t));
  ok("a token does not verify for a different address", !verifyToken("bob@gitam.in", t));
  ok("a tampered token is rejected", !verifyToken("ada@gitam.in", t.slice(0, -1) + (t.endsWith("a") ? "b" : "a")));
  ok("an empty token is rejected", !verifyToken("ada@gitam.in", ""));
  ok("unsubscribe links are signed", unsubscribeUrl("https://club.test", "ada@gitam.in").includes(`t=${t}`));

  // --- not configured: safe no-op ---
  for (const k of ["EMAIL_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY"]) delete process.env[k];
  const none = await sendEmail("x@y.in", w);
  ok("with no email settings nothing is sent and the caller is told", !none.sent && none.reason === "not-configured" && !emailConfigured());

  // --- real SMTP ---
  Object.assign(process.env, { EMAIL_FROM: "GitHub Community Club <club@test>", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtpPort), SMTP_USER: "club@test", SMTP_PASS: "app-password" });
  const r1 = await sendEmail("ada@gitam.in", w, { unsubscribe: "https://club.test/api/unsubscribe?e=a" });
  ok("SMTP: an email is delivered", r1.sent && inbox.length === 1);
  ok("SMTP: subject, sender and recipient are right", inbox[0]?.subject?.startsWith("Welcome to the GitHub Community Club") === true && toOf(inbox[0]) === "ada@gitam.in" && inbox[0].from?.text.includes("club@test") === true);
  ok("SMTP: has HTML and text parts and List-Unsubscribe headers", !!inbox[0]?.html && !!inbox[0].text && raw(inbox[0], "list-unsubscribe").includes("/api/unsubscribe") && raw(inbox[0], "list-unsubscribe-post") === "List-Unsubscribe=One-Click");
  process.env.SMTP_PASS = "wrong";
  const bad = await sendEmail("ada@gitam.in", w);
  ok("SMTP: a wrong password reports failure instead of crashing", !bad.sent && bad.reason === "failed");
  process.env.SMTP_PASS = "app-password";

  // --- Resend path (fetch is mocked) ---
  const realFetch = globalThis.fetch; const resend: { url: string; body: Record<string, unknown>; auth: string }[] = [];
  delete process.env.SMTP_HOST; process.env.RESEND_API_KEY = "re_test";
  globalThis.fetch = (async (u: string, init: RequestInit) => { resend.push({ url: String(u), body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) }); return new Response("{}", { status: 200 }); }) as typeof fetch;
  const r2 = await sendEmail("ada@gitam.in", w, { unsubscribe: "https://club.test/x" });
  ok("Resend: posts to the API with the key and the right fields", r2.sent && resend[0]?.url === "https://api.resend.com/emails" && resend[0].auth === "Bearer re_test" && resend[0].body.to === "ada@gitam.in" && !!resend[0].body.html);
  globalThis.fetch = (async () => new Response("nope", { status: 403 })) as typeof fetch;
  const r3 = await sendEmail("ada@gitam.in", w);
  ok("Resend: an API error is reported, not thrown", !r3.sent && r3.reason === "failed");
  globalThis.fetch = realFetch; delete process.env.RESEND_API_KEY; process.env.SMTP_HOST = "127.0.0.1";

  // --- routes, against the fake database + real SMTP ---
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${dbPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" });
  const { POST: join } = await import("../app/api/join/route");
  const { POST: broadcast } = await import("../app/api/broadcast/route");
  const { POST: unsub } = await import("../app/api/unsubscribe/route");
  const human = { elapsedMs: 20_000 };

  inbox.length = 0;
  let r = await join(postJson("http://x/api/join", { handle: "ada", email: "Ada@Gitam.in", firstEvent: "2026-10-07", ...human }, { "x-forwarded-for": "9.9.9.1" }));
  await settle();
  ok("join: a new sign-up is stored and answered 201", r.status === 201 && db.joins.length === 1 && db.joins[0].email === "ada@gitam.in");
  ok("join: exactly one welcome email arrives, addressed to them", inbox.length === 1 && toOf(inbox[0]) === "ada@gitam.in");
  ok("join: the welcome mentions their handle and chosen first event", inbox[0]?.text?.includes("@ada") === true && inbox[0].text.includes("Learn GitHub & Make Your First Contribution"));
  const link = inbox[0]?.text?.match(/Unsubscribe: (\S+)/)?.[1] ?? "";
  ok("join: the unsubscribe link in the email is signed and valid", verifyToken("ada@gitam.in", new URL(link).searchParams.get("t") ?? ""));

  inbox.length = 0;
  r = await join(postJson("http://x/api/join", { handle: "ada", email: "ada@gitam.in", firstEvent: "2026-10-07", ...human }, { "x-forwarded-for": "9.9.9.2" }));
  await settle();
  ok("join: signing up twice says 'already on the list' and sends no second email", r.status === 200 && (await r.json()).status === "exists" && inbox.length === 0);

  // a failing mail server must not break joining
  process.env.SMTP_PASS = "wrong";
  r = await join(postJson("http://x/api/join", { handle: "bob", email: "bob@gitam.in", firstEvent: "2026-10-12", ...human }, { "x-forwarded-for": "9.9.9.3" }));
  ok("join: if the email server fails, the sign-up still succeeds", r.status === 201 && db.joins.length === 2);
  process.env.SMTP_PASS = "app-password";
  db.joins.push({ email: "cleo@gitam.in", unsubscribed: false });

  // broadcast
  const goodBody = { subject: "GIT Merge 26 is on Monday", message: "Bring a laptop.\n\nDetails: https://club.test/events/git-merge-26" };
  r = await broadcast(postJson("http://x/api/broadcast", goodBody));
  ok("broadcast: no login → 401", r.status === 401);
  db.role = "attendee";
  r = await broadcast(postJson("http://x/api/broadcast", goodBody, { authorization: "Bearer t" }));
  ok("broadcast: a signed-in non-admin → 403, nothing sent", r.status === 403 && inbox.length === 0);
  db.role = "admin";
  r = await broadcast(postJson("http://x/api/broadcast", { subject: "x", message: "short" }, { authorization: "Bearer t" }));
  ok("broadcast: a too-short subject/message → 422", r.status === 422);
  inbox.length = 0;
  r = await broadcast(postJson("http://x/api/broadcast", goodBody, { authorization: "Bearer t" }));
  const j = await r.json();
  ok("broadcast: an admin sends to every subscribed address", r.status === 200 && j.sent === 3 && j.failed === 0 && inbox.length === 3);
  ok("broadcast: each recipient gets their own personal unsubscribe link", new Set(inbox.map((m) => m.text?.match(/Unsubscribe: (\S+)/)?.[1])).size === 3);
  ok("broadcast: it is logged with subject and recipient count", (db.broadcasts[0] as { recipients: number; subject: string })?.recipients === 3);
  db.joins[2].unsubscribed = true; inbox.length = 0;
  r = await broadcast(postJson("http://x/api/broadcast", goodBody, { authorization: "Bearer t" }));
  ok("broadcast: people who unsubscribed are skipped", (await r.json()).sent === 2 && inbox.length === 2);
  delete process.env.SMTP_HOST;
  r = await broadcast(postJson("http://x/api/broadcast", goodBody, { authorization: "Bearer t" }));
  ok("broadcast: with email not set up it explains instead of failing silently", r.status === 503);
  process.env.SMTP_HOST = "127.0.0.1";

  // unsubscribe
  const tok = tokenFor("ada@gitam.in");
  r = await unsub(new Request(`http://x/api/unsubscribe?e=ada%40gitam.in&t=${tok}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }));
  ok("unsubscribe: a mail app's one-click POST works", r.status === 200 && db.unsub.includes("ada@gitam.in"));
  r = await unsub(new Request("http://x/api/unsubscribe?e=bob%40gitam.in&t=deadbeef", { method: "POST" }));
  ok("unsubscribe: a wrong token is refused and changes nothing", r.status === 400 && !db.unsub.includes("bob@gitam.in"));
  const form = new FormData(); form.set("e", "bob@gitam.in"); form.set("t", tokenFor("bob@gitam.in"));
  r = await unsub(new Request("http://x/api/unsubscribe", { method: "POST", body: form }));
  ok("unsubscribe: the confirmation page's form works and redirects to 'done'", r.status === 303 && (r.headers.get("location") ?? "").includes("done=1") && db.unsub.includes("bob@gitam.in"));

  console.log(fails ? `\n${fails} FAILED` : "\nall email checks passed");
  smtp.close(); fake.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e); process.exit(1); });
