/* Importing who came from Luma's guest-list CSV: only checked-in guests, clean names/emails, GitHub handles. */
import { fromLine, fromLumaCsv, githubHandle, parseCsv } from "../lib/attendance";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

ok("CSV: quotes, commas and newlines inside quotes, CRLF", JSON.stringify(parseCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\r\n')) === JSON.stringify([["a", "b, c", 'say "hi"'], ["1", "two\nlines", "3"]]));
ok("CSV: a byte-order mark and blank lines are ignored", parseCsv("﻿x,y\n\n1,2\n").length === 2);

// the columns Luma exports (trimmed), with a custom question about GitHub
const luma = [
  'api_id,name,first_name,last_name,email,phone_number,created_at,approval_status,checked_in_at,"What\'s your GitHub username?"',
  'g1,Ada Lovelace,Ada,Lovelace,Ada@GITAM.in,,2026-10-01T10:00:00Z,approved,2026-10-07T09:58:12Z,https://github.com/ada-l',
  'g2,Grace Hopper,Grace,Hopper,grace@gitam.in,,2026-10-01T10:00:00Z,approved,,@grace',
  'g3,,Alan,Turing,alan@gitam.in,,2026-10-01T10:00:00Z,approved,2026-10-07T10:05:00Z,not a handle!',
  'g4,"Ada, again",Ada,L,ada@gitam.in,,2026-10-01T10:00:00Z,approved,2026-10-07T10:06:00Z,',
  'g5,No Email,No,Email,,,2026-10-01T10:00:00Z,approved,2026-10-07T10:07:00Z,',
].join("\n");
const r = fromLumaCsv(luma);
ok("only checked-in guests count", r.attendees.length === 2 && r.skipped.notCheckedIn === 1 && r.hasCheckIn);
ok("emails are lowercased and de-duplicated", r.attendees[0].email === "ada@gitam.in" && r.skipped.duplicate === 1);
ok("a missing full name is built from first + last", r.attendees[1].name === "Alan Turing");
ok("rows without an email are skipped and counted", r.skipped.noEmail === 1);
ok("GitHub handles come from a GitHub question (URL or @)", r.attendees[0].handle === "ada-l" && r.attendees[1].handle === undefined);

const noCheckIn = fromLumaCsv("name,email,approval_status\nAda,ada@x.in,approved\nBob,bob@x.in,declined\n");
ok("without a check-in column, approved guests are used — and the import says so", noCheckIn.attendees.length === 1 && !noCheckIn.hasCheckIn);
ok("a CSV that isn't a guest list gives nothing", fromLumaCsv("foo,bar\n1,2\n").attendees.length === 0);

ok("typing a person by hand", JSON.stringify(fromLine("Ada Lovelace, Ada@gitam.in, @ada-l")) === JSON.stringify({ name: "Ada Lovelace", email: "ada@gitam.in", handle: "ada-l" }));
ok("a bad line is refused", fromLine("Ada") === null && fromLine("A, ada@gitam.in") === null && fromLine("Ada, not-an-email") === null);
ok("GitHub handles are checked", githubHandle("github.com/ok-name") === undefined && githubHandle("https://github.com/ok-name/repo") === "ok-name" && githubHandle("-bad") === undefined);

if (fails) { console.log(`${fails} attendance check(s) failed`); process.exit(1); }
console.log("all attendance checks passed");
