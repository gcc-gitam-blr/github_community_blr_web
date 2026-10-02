/* Certificates: the email, the LinkedIn link and the certificate number. */
import { certNumber, certificateUrl, eventTitle, linkedinUrl } from "../lib/certificates";
import { certificateEmail } from "../lib/email/templates";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const id = "2b7c9e10-1f2a-4c3d-9e8f-0a1b2c3d4e5f", site = "https://githubcommunityblr.vercel.app/";

ok("the certificate link lives on the site", certificateUrl(site, id) === `https://githubcommunityblr.vercel.app/certificates/${id}`);
ok("certificate numbers are short and stable", certNumber(id) === "GCC-2B7C9E10");
ok("events are named from the club calendar", eventTitle("2026-10-12") === "GIT Merge 26" && eventTitle("1999-01-01") === "1999-01-01");

const li = new URL(linkedinUrl({ event: "2026-10-07", id, issued: "2026-10-07T12:00:00Z", site }));
ok("LinkedIn opens 'add certification' filled in", li.hostname === "www.linkedin.com" && li.searchParams.get("startTask") === "CERTIFICATION_NAME");
ok("…with the event, the club, the month and the proof link", li.searchParams.get("name")!.startsWith("Learn GitHub") && li.searchParams.get("organizationName") === "GitHub Community Club BLR" && li.searchParams.get("issueYear") === "2026" && li.searchParams.get("issueMonth") === "10" && li.searchParams.get("certUrl") === certificateUrl(site, id));

const m = certificateEmail({ name: "Ada <script>Lovelace", eventTitle: "GIT Merge 26", url: "https://x/certificates/1", linkedin: "https://www.linkedin.com/profile/add?x=1", site: "https://x" });
ok("the subject names the event", m.subject === "Your certificate: GIT Merge 26");
ok("the email links the certificate and LinkedIn", m.html.includes("https://x/certificates/1") && m.html.includes("linkedin.com/profile/add") && m.text.includes("https://x/certificates/1"));
ok("names are escaped in the HTML", !m.html.includes("<script>") && m.html.includes("Ada &lt;script&gt;Lovelace".split(" ")[0]));

if (fails) { console.log(`${fails} certificate check(s) failed`); process.exit(1); }
console.log("all certificate checks passed");
