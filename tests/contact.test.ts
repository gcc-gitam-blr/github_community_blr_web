/* "Get involved": the shared validator and /api/contact, with a real SMTP inbox and a fake database. */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { SMTPServer } from "smtp-server";
import { simpleParser, type ParsedMail } from "mailparser";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const inbox: ParsedMail[] = [];
const smtp = new SMTPServer({ authOptional: true, disabledCommands: ["STARTTLS"], allowInsecureAuth: true, onAuth: (_a, _s, cb) => cb(null, { user: 1 }), onData(s, _x, cb) { simpleParser(s).then((m) => { inbox.push(m); cb(); }).catch(cb); } });
const saved: Record<string, unknown>[] = []; let dbFails = false;
const fake = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  if (req.url?.startsWith("/rest/v1/messages") && req.method === "POST") { if (dbFails) { res.writeHead(500); return res.end("{}"); } saved.push(JSON.parse(b)); res.writeHead(201); return res.end(); }
  res.writeHead(404); res.end();
}); });
const post = (body: unknown, ip: string) => new Request("http://x/api/contact", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const toOf = (m: ParsedMail) => (m.to && !Array.isArray(m.to) ? m.to.text : "");
const settle = () => new Promise((r) => setTimeout(r, 300));

(async () => {
  const smtpPort = await new Promise<number>((r) => smtp.listen(0, "127.0.0.1", () => r((smtp.server.address() as AddressInfo).port)));
  const dbPort = await new Promise<number>((r) => fake.listen(0, "127.0.0.1", () => r((fake.address() as AddressInfo).port)));
  const { validateContact } = await import("../lib/contact");
  const human = { elapsedMs: 20_000 };
  const good = { kind: "apply", name: "Ada Lovelace", email: "ada@gitam.in", handle: "@ada", message: "I'd love to help run events and design.", ...human };

  ok("a complete application is valid", validateContact(good) === null);
  ok("a question doesn't need a GitHub username", validateContact({ ...good, kind: "question", handle: "" }) === null);
  ok("a core-team application does need one", validateContact({ ...good, handle: "" }) !== null);
  ok("an unknown kind is rejected", validateContact({ ...good, kind: "hack" }) !== null);
  ok("a one-word message is rejected", validateContact({ ...good, message: "hi" }) !== null);
  ok("a 3001-character message is rejected", validateContact({ ...good, message: "x".repeat(3001) }) !== null);
  ok("a bad email is rejected", validateContact({ ...good, email: "ada@" }) !== null);
  ok("a filled honeypot is spam", validateContact({ ...good, website: "x" }) === "spam");
  ok("an instant submit is spam", validateContact({ ...good, elapsedMs: 100 }) === "spam");

  Object.assign(process.env, { NEXT_PUBLIC_SITE_URL: "https://club.test", EMAIL_SECRET: "s" });
  const { POST } = await import("../app/api/contact/route");
  const { CLUB } = await import("../lib/config");
  const club = CLUB.email || "club@test"; // the club email from the content editor, else the sending account

  // 1) nothing configured
  let r = await POST(post(good, "1.1.1.1"));
  ok("with no database and no email it says so (503) instead of pretending", r.status === 503);

  // 2) database + email
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${dbPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", EMAIL_FROM: "Club <club@test>", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtpPort), SMTP_USER: "club@test", SMTP_PASS: "p" });
  r = await POST(post(good, "2.2.2.2")); await settle();
  ok("a valid message is saved (201)", r.status === 201 && saved.length === 1);
  ok("it is saved cleanly: lower-cased email, handle without @", saved[0].email === "ada@gitam.in" && saved[0].handle === "ada" && saved[0].kind === "apply");
  const note = inbox.find((m) => toOf(m) === club), ack = inbox.find((m) => toOf(m) === "ada@gitam.in");
  ok("the club inbox gets a notification", !!note && note.subject === "[Join the core team] Ada Lovelace");
  ok("replying to the notification goes to the sender", note?.replyTo?.text === "ada@gitam.in");
  ok("the notification shows their message and GitHub link", note?.text?.includes("I'd love to help run events") === true && note.html !== false && String(note.html).includes("github.com/ada"));
  ok("the sender gets a short acknowledgement", !!ack && ack.subject === "We got your message" && ack.text?.includes("Thanks, Ada") === true);

  // 3) hostile input is escaped in the HTML email
  inbox.length = 0;
  await POST(post({ ...good, name: "Eve <img src=x onerror=alert(1)>", message: "<script>alert(1)</script> hello there friend" }, "3.3.3.3")); await settle();
  const evil = inbox.find((m) => toOf(m) === club);
  ok("anything a person typed is escaped in the HTML", !!evil && !String(evil.html).includes("<script>") && !String(evil.html).includes("<img src=x") && String(evil.html).includes("&lt;script&gt;"));

  // 4) spam, errors, limits
  const before = saved.length;
  r = await POST(post({ ...good, website: "http://spam" }, "4.4.4.4"));
  ok("spam gets a quiet 200 and is not saved", r.status === 200 && saved.length === before);
  r = await POST(post({ ...good, email: "nope" }, "5.5.5.5"));
  ok("invalid input is a 422 with a helpful message", r.status === 422 && typeof (await r.json()).error === "string");
  dbFails = true; r = await POST(post(good, "6.6.6.6"));
  ok("a database error is a 502 and sends no email", r.status === 502); dbFails = false;
  let last = 0; for (let i = 0; i < 7; i++) last = (await POST(post(good, "7.7.7.7"))).status;
  ok("the 6th message from one IP in 10 minutes is rate-limited (429)", last === 429);
  r = await POST(new Request("http://x/api/contact", { method: "POST", body: "not json" }));
  ok("malformed JSON is a 400", r.status === 400);

  // 5) email only (no database)
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; inbox.length = 0; const n = saved.length;
  r = await POST(post(good, "8.8.8.8")); await settle();
  ok("with email but no database, it still reaches the club inbox", r.status === 201 && saved.length === n && inbox.some((m) => toOf(m) === club));

  console.log(fails ? `\n${fails} FAILED` : "\nall contact checks passed"); smtp.close(); fake.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e); process.exit(1); });
