/* Certificates: the email, the LinkedIn link and the certificate number. */
import { certNumber, certificateUrl, eventTitle, linkedinUrl } from "../lib/certificates";
import { certificateEmail, greetName, noteProblem } from "../lib/email/templates";
import { EVENTS } from "../lib/events";
import { CLUB } from "../lib/config";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const id = "2b7c9e10-1f2a-4c3d-9e8f-0a1b2c3d4e5f", site = "https://githubcommunityblr.vercel.app/";

ok("the certificate link lives on the site", certificateUrl(site, id) === `https://githubcommunityblr.vercel.app/certificates/${id}`);
ok("certificate numbers are short and stable", certNumber(id) === "GCC-2B7C9E10");
// Read from the calendar, not typed in: renaming an event in the content editor must not fail CI.
const first = EVENTS[0];
ok("events are named from the club calendar", eventTitle(first.date) === first.title && eventTitle("1999-01-01") === "1999-01-01");

const li = new URL(linkedinUrl({ event: "2026-10-12", id, issued: "2026-10-07T12:00:00Z", site }));
ok("LinkedIn opens 'add certification' filled in", li.hostname === "www.linkedin.com" && li.searchParams.get("startTask") === "CERTIFICATION_NAME");
ok("…with the event, the club, the month and the proof link", li.searchParams.get("name")!.startsWith(eventTitle("2026-10-12")) && li.searchParams.get("organizationName") === CLUB.name && li.searchParams.get("issueYear") === "2026" && li.searchParams.get("issueMonth") === "10" && li.searchParams.get("certUrl") === certificateUrl(site, id));

const m = certificateEmail({ name: "Ada <script>Lovelace", eventTitle: "GIT Merge 26", url: "https://x/certificates/1", site: "https://x" });
ok("the subject is a thank-you that names the event", m.subject === "Thanks for coming to GIT Merge 26: your certificate");
ok("the certificate link is shown as its real address, not hidden behind a button", m.html.includes('href="https://x/certificates/1"') && m.html.includes(">x/certificates/1</a>") && m.text.includes("https://x/certificates/1"));
ok("few links, to look less like phishing: no LinkedIn link in the email (it's on the certificate page)", !m.html.includes("linkedin.com") && (m.html.match(/<a /g) ?? []).length <= 3);
ok("the email names the person and the event in its text", m.html.includes("made out to <b>Ada &lt;script&gt;Lovelace</b>") && m.text.includes("GIT Merge 26"));
ok("names are escaped in the HTML", !m.html.includes("<script>") && m.html.includes("Ada &lt;script&gt;Lovelace".split(" ")[0]));

ok("someone is greeted by their first name, not by a GitHub username", greetName("Ada Lovelace") === "Ada" && greetName("Ruchitha") === "Ruchitha" && greetName("lechakrawarthy") === null && greetName("ruchithat25") === null && greetName("dev-nisha") === null);
const u = certificateEmail({ name: "lechakrawarthy", eventTitle: "GitHub 101", url: "https://x/c/2", site: "https://x",
  feedback: "https://x/events/github-101#feedback", next: { title: "GIT Merge 26", date: "Wednesday, 28 October 2026", url: "https://luma.com/x" } });
ok("…so a username on file gets a plain thank-you", u.html.includes(">Thanks for coming</h1>") && !u.html.includes("Thanks for coming, lechakrawarthy") && u.text.startsWith("Thanks for coming!"));
ok("the email asks for feedback, names the next event, and says how to fix a misspelt name", u.html.includes("https://x/events/github-101#feedback") && u.html.includes("GIT Merge 26") && u.text.includes("Reply to this email"));
ok("without a next event it still says see you at the next one", m.html.includes("See you at the next one!"));

const fest = certificateEmail({ name: "Ruchitha T", eventTitle: "GitHub 101", url: "https://x/c/3", site: "https://x", subject: "Happy Dussehra, and your certificate",
  note: "Happy Dussehra, {name}! <b>Wishing</b> you a joyful one.\n\nYou made your first move at {event}." });
ok("the team's message sits under the greeting, with {name} and {event} filled in, as paragraphs", fest.html.includes("Happy Dussehra, Ruchitha!") && fest.html.includes("first move at GitHub 101") && (fest.html.match(/<p style="margin:0 0 8px">/g) ?? []).length === 2 && fest.text.includes("Happy Dussehra, Ruchitha!"));
ok("…escaped, so a message can't add HTML to the email", !fest.html.includes("<b>Wishing</b>") && fest.html.includes("&lt;b&gt;Wishing"));
ok("the subject can be the team's own; empty keeps the standard one", fest.subject === "Happy Dussehra, and your certificate" && m.subject === "Thanks for coming to GIT Merge 26: your certificate");
ok("a [placeholder] left in from a starter message stops the send, and so does an overlong message", noteProblem("Happy [festival], {name}!", "")?.includes("[festival]") === true && noteProblem("x".repeat(801), "") !== null && noteProblem("Happy Dussehra, {name}!", "") === null);

if (fails) { console.log(`${fails} certificate check(s) failed`); process.exit(1); }
console.log("all certificate checks passed");
