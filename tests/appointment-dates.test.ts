/* The wording and date maths on /admin → People & roles (India dates, like the database). */
import { addDays, daysLeft, endsLabel, endsSoon, niceDate, todayIST } from "../lib/admin/appointments";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };
const at = (iso: string) => Date.parse(iso);

ok("17 Oct 2026 18:29 UTC is still 17 Oct in India", todayIST(at("2026-10-17T18:29:00Z")) === "2026-10-17");
ok("18:31 UTC is already 18 Oct in India", todayIST(at("2026-10-17T18:31:00Z")) === "2026-10-18");
ok("days are counted across month ends and leap years", addDays("2027-02-27", 2) === "2027-03-01" && addDays("2028-02-28", 1) === "2028-02-29");
const now = at("2026-10-17T10:00:00Z");
ok("an end date today says so, and counts as still ending soon", daysLeft("2026-10-17", now) === 0 && endsLabel("2026-10-17", now) === "ends today" && endsSoon("2026-10-17", now));
ok("tomorrow and later", endsLabel("2026-10-18", now) === "ends tomorrow" && endsLabel("2026-10-27", now) === "ends in 10 days");
ok("yesterday has ended", daysLeft("2026-10-16", now) === -1 && endsLabel("2026-10-16", now) === "ended");
ok("14 days is soon, 15 is not", endsSoon("2026-10-31", now) && !endsSoon("2026-11-01", now));
ok("the late-evening UTC edge: 19:00 UTC on the 17th, an end date of the 18th is today in India", endsLabel("2026-10-18", at("2026-10-17T19:00:00Z")) === "ends today");
ok("dates read nicely", niceDate("2027-06-30") === "30 Jun 2027");
console.log(fails ? `\n${fails} FAILED` : "\nall appointment date checks passed"); process.exit(fails ? 1 : 0);
