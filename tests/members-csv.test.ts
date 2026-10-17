/* Reading a members spreadsheet and writing the export. */
import { membersCsv, parseMembersCsv, type Member } from "../lib/admin/members";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const a = parseMembersCsv("Name,Email,GitHub\nAda Lovelace,ada@gitam.in,x\n");
ok("a file without a name or email column is explained", a.problem !== null && a.rows.length === 0);
const b = parseMembersCsv("﻿handle,name,email,team,joined_on\r\n@ada,\"Lovelace, Ada\",ada@gitam.in,Tech,2025-08-01\r\nhttps://github.com/bea,Bea Bee,bea@gitam.in,,\r\n\r\n");
ok("columns are found by name (BOM, CRLF, quotes with commas, a blank line)", b.problem === null && b.rows.length === 2 && b.rows[0].name === "Lovelace, Ada" && b.rows[0].team === "Tech" && b.rows[0].joined_on === "2025-08-01");
ok("GitHub handles are read from @name and from profile links", b.rows[0].handle === "ada" && b.rows[1].handle === "bea");
const c = parseMembersCsv("email,name,Joined On\nada@gitam.in,Ada Lovelace,2025-08-01");
ok("columns can be in any order, spaced names work, optional ones may be missing", c.rows[0].email === "ada@gitam.in" && c.rows[0].joined_on === "2025-08-01" && c.rows[0].handle === "" && c.rows[0].team === "");
ok("a handle that isn't one is passed through, so the database can report that row", parseMembersCsv("name,email,handle\nAda Lovelace,ada@gitam.in,not a handle!").rows[0].handle === "not a handle!");
ok("only a header line is explained too", parseMembersCsv("name,email\n").problem !== null && parseMembersCsv("   \n").problem !== null);
ok("more than 500 people are refused up front", parseMembersCsv("name,email\n" + Array.from({ length: 501 }, (_, i) => `P ${i},p${i}@x.in`).join("\n")).problem !== null);

const m = (over: Partial<Member>): Member => ({ id: "1", handle: "ada", name: "Ada", email: "ada@gitam.in", team: "Tech", joined_on: "2025-08-01", status: "active", status_since: "2025-08-01", left_on: null, created_at: "", user_id: null, source_application_id: null, ...over });
const out = membersCsv([m({}), m({ name: "=HYPERLINK(\"http://evil\")", handle: null as unknown as string, team: null as unknown as string })]);
ok("the export has a header and one line per member", out.split("\n").length === 3 && out.startsWith("handle,name,email,team,status,joined_on,left_on"));
ok("a cell that starts with = is neutralised so a spreadsheet won't run it", out.includes(`"'=HYPERLINK(""http://evil"")"`) && !out.includes(`,"=HYPERLINK`));
console.log(fails ? `\n${fails} FAILED` : "\nall members-csv checks passed"); process.exit(fails ? 1 : 0);
