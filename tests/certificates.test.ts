/* Certificates: the email, the LinkedIn link and the certificate number. */
import { certNumber, certificateUrl, eventTitle, linkedinUrl } from "../lib/certificates";
import { certificateEmail, greetName } from "../lib/email/templates";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const id = "2b7c9e10-1f2a-4c3d-9e8f-0a1b2c3d4e5f", site = "https://githubcommunityblr.vercel.app/";

ok("the certificate link lives on the site", certificateUrl(site, id) === `https://githubcommunityblr.vercel.app/certificates/${id}`);
ok("certificate numbers are short and stable", certNumber(id) === "GCC-2B7C9E10");
ok("events are named from the club calendar", eventTitle("2026-10-28") === "GIT Merge 26" && eventTitle("1999-01-01") === "1999-01-01");

const li = new URL(linkedinUrl({ event: "2026-10-12", id, issued: "2026-10-07T12:00:00Z", site }));
ok("LinkedIn opens 'add certification' filled in", li.hostname === "www.linkedin.com" && li.searchParams.get("startTask") === "CERTIFICATION_NAME");
ok("…with the event, the club, the month and the proof link", li.searchParams.get("name")!.startsWith(eventTitle("2026-10-12")) && li.searchParams.get("organizationName") === "GitHub Community Club BLR" && li.searchParams.get("issueYear") === "2026" && li.searchParams.get("issueMonth") === "10" && li.searchParams.get("certUrl") === certificateUrl(site, id));

const m = certificateEmail({ name: "Ada <script>Lovelace", eventTitle: "GIT Merge 26", url: "https://x/certificates/1", linkedin: "https://www.linkedin.com/profile/add?x=1", site: "https://x" });
ok("the subject names the event", m.subject === "Your certificate: GIT Merge 26");
ok("the email links the certificate and LinkedIn", m.html.includes("https://x/certificates/1") && m.html.includes("linkedin.com/profile/add") && m.text.includes("https://x/certificates/1"));
ok("names are escaped in the HTML", !m.html.includes("<script>") && m.html.includes("Ada &lt;script&gt;Lovelace".split(" ")[0]));

ok("someone is greeted by their first name, not by a GitHub username", greetName("Ada Lovelace") === "Ada" && greetName("Ruchitha") === "Ruchitha" && greetName("lechakrawarthy") === null && greetName("ruchithat25") === null && greetName("dev-nisha") === null);
const u = certificateEmail({ name: "lechakrawarthy", eventTitle: "GitHub 101", url: "https://x/c/2", linkedin: "https://www.linkedin.com/profile/add?x=2", site: "https://x",
  feedback: "https://x/events/github-101#feedback", next: { title: "GIT Merge 26", date: "Wednesday, 28 October 2026", url: "https://luma.com/x" } });
ok("…so a username on file gets a plain thank-you", u.html.includes("Thanks for coming 🎉") && !u.html.includes("lechakrawarthy") && u.text.startsWith("Thanks for coming!"));
ok("the email asks for feedback, names the next event with its RSVP, and says how to fix a misspelt name", u.html.includes("https://x/events/github-101#feedback") && u.html.includes("GIT Merge 26") && u.html.includes("https://luma.com/x") && u.text.includes("Reply to this email"));
ok("without a next event it still says see you at the next one", m.html.includes("See you at the next one!"));

if (fails) { console.log(`${fails} certificate check(s) failed`); process.exit(1); }
console.log("all certificate checks passed");
