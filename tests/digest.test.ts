/* The Monday digest to organisers: the summary, who gets it, the email, and the cron route's door. */
import { buildDigest, digestHeadline, digestRecipients, FIRST_HANDLES } from "../lib/digest";
import { digestEmail } from "../lib/email/templates";
import { CLUB } from "../lib/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const now = new Date("2026-10-05T03:30:00Z"); // Monday 9:00 in India, when the cron runs
const ev = CLUB.events[0];

// the summary
ok("a quiet week gives no digest (so no email)", buildDigest({ signups: [], messages: [], feedback: [] }, now) === null);
const signups = ["zed", "amy", "bo", "cy", "di", "ed", "fi"].map((handle, i) => ({ handle, created_at: `2026-10-0${i % 2 ? 1 : 2}T0${i}:00:00Z` }));
const d = buildDigest({
  signups,
  messages: [{ kind: "apply" }, { kind: "question" }, { kind: "apply" }, { kind: "nonsense" }],
  feedback: [{ event: ev.date, rating: 5 }, { event: ev.date, rating: 4 }, { event: ev.date, rating: 4 }, { event: "1999-01-01", rating: 2 }],
}, now)!;
ok("sign-ups are counted", d.signups.count === 7);
ok(`only the first ${FIRST_HANDLES} handles are listed, oldest first`, d.signups.first.length === FIRST_HANDLES && d.signups.first[0] === "amy");
ok("messages are grouped by kind with readable names, unknown kinds left out", d.messages.length === 2 && d.messages[0].label === "Join the core team" && d.messages[0].count === 2 && d.messages[1].count === 1);
ok("feedback is averaged per event, to one decimal", d.feedback[0].event === ev.title && d.feedback[0].average === 4.3 && d.feedback[0].count === 3);
ok("feedback for an event not on the calendar keeps its date", d.feedback[1].event === "1999-01-01" && d.feedback[1].average === 2);
ok("the week runs from last Monday to today, in India", d.from === "2026-09-28" && d.to === "2026-10-05");
ok("the headline adds it up", digestHeadline(d) === "7 sign-ups, 3 messages, 4 ratings");
const one = buildDigest({ signups: [{ handle: "amy", created_at: "2026-10-01T00:00:00Z" }], messages: [], feedback: [] }, now)!;
ok("a week with only one sign-up says just that", digestHeadline(one) === "1 sign-up" && one.messages.length === 0 && one.feedback.length === 0);

// who gets it
const admins = [{ email: "Lead@Gitam.in" }, { email: null }, { email: "lead@gitam.in" }, { email: "second@gitam.in" }];
ok("without ORGANISER_EMAILS, every admin with an email gets it once", digestRecipients(undefined, admins).join() === "lead@gitam.in,second@gitam.in");
ok("ORGANISER_EMAILS replaces the admin list (commas or spaces, junk dropped)", digestRecipients(" a@gitam.in, b@gitam.in  nope ", admins).join() === "a@gitam.in,b@gitam.in");
ok("an empty ORGANISER_EMAILS falls back to the admins", digestRecipients("  ", admins).length === 2);

// the email
const mail = digestEmail(d, "https://example.org");
ok("the subject says what happened", mail.subject === "Club week: 7 sign-ups, 3 messages, 4 ratings");
ok("it links to /admin", mail.html.includes("https://example.org/admin") && mail.text.includes("https://example.org/admin"));
ok("it lists handles and the rest as a number", mail.text.includes("@amy") && mail.text.includes("and 2 more"));
ok("it shows the average rating per event", mail.text.includes(`Feedback: ${ev.title}`) && mail.text.includes("4.3 / 5 from 3 ratings"));
const nasty = digestEmail(buildDigest({ signups: [], messages: [], feedback: [{ event: "<script>", rating: 3 }] }, now)!, "https://example.org");
ok("anything stored is escaped in the HTML", !nasty.html.includes("<script>") && nasty.html.includes("&lt;script&gt;"));

// the cron route: only Vercel's cron (with the secret) gets in, and without a database it does nothing and says why
(async () => {
  for (const k of ["CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ORGANISER_EMAILS"]) delete process.env[k];
  const { GET } = await import("../app/api/cron/digest/route");
  const call = (auth?: string) => GET(new Request("http://x/api/cron/digest", { headers: auth ? { authorization: auth } : {} }));
  ok("without CRON_SECRET the digest is off", (await call("Bearer anything")).status === 503);
  process.env.CRON_SECRET = "s3cret-value";
  ok("no Authorization header is refused", (await call()).status === 401);
  ok("a wrong secret is refused", (await call("Bearer s3cret-valuX")).status === 401 && (await call("s3cret-value")).status === 401);
  const r = await call("Bearer s3cret-value"), j = await r.json();
  ok("the right secret without a database does nothing and says why", r.status === 200 && j.sent === 0 && /database/i.test(j.skipped));

  if (fails) { console.log(`${fails} digest check(s) failed`); process.exit(1); }
  console.log("all digest checks passed");
})();
