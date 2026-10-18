/* Reading a members spreadsheet (CSV or Excel) and writing the export. */
import { deflateRawSync } from "node:zlib";
import { membersCsv, parseMembersCsv, parseMembersTable, toIsoDate, type Member } from "../lib/admin/members";
import { readXlsx } from "../lib/admin/xlsx";

let fails = 0; const ok = (n: string, c: boolean) => { console.log((c ? "PASS" : "FAIL") + "  " + n); if (!c) fails++; };

const a = parseMembersCsv("Full name,Mail,GitHub\nAda Lovelace,ada@gitam.in,x\n");
ok("columns are found by the words people use: Full name, Mail, GitHub", a.problem === null && a.rows[0].name === "Ada Lovelace" && a.rows[0].email === "ada@gitam.in" && a.rows[0].handle === "x");
const b = parseMembersCsv("﻿handle,name,email,team,joined_on\r\n@ada,\"Lovelace, Ada\",ada@gitam.in,Tech,2025-08-01\r\nhttps://github.com/bea,Bea Bee,bea@gitam.in,,\r\n\r\n");
ok("columns are found by name (BOM, CRLF, quotes with commas, a blank line)", b.problem === null && b.rows.length === 2 && b.rows[0].name === "Lovelace, Ada" && b.rows[0].team === "Tech" && b.rows[0].joined_on === "2025-08-01");
ok("GitHub handles are read from @name and from profile links", b.rows[0].handle === "ada" && b.rows[1].handle === "bea");
const c = parseMembersCsv("email,name,Joined On\nada@gitam.in,Ada Lovelace,2025-08-01");
ok("columns can be in any order, spaced names work, optional ones may be missing", c.rows[0].email === "ada@gitam.in" && c.rows[0].joined_on === "2025-08-01" && c.rows[0].handle === "" && c.rows[0].team === "");
ok("a handle that isn't one is passed through, so the database can report that row", parseMembersCsv("name,email,handle\nAda Lovelace,ada@gitam.in,not a handle!").rows[0].handle === "not a handle!");
ok("only a header line is explained too", parseMembersCsv("name,email\n").problem !== null && parseMembersCsv("   \n").problem !== null);
ok("more than 500 people are refused up front", parseMembersCsv("name,email\n" + Array.from({ length: 501 }, (_, i) => `P ${i},p${i}@x.in`).join("\n")).problem !== null);

const sheet = parseMembersCsv([
  "Timestamp,Name of the student,Roll No,Email ID,GitHub Username,Domain,Date of joining",
  "1/8/2025 10:00,Bea Bee,BU22CSE001,BEA@gitam.in,https://github.com/bea-b,Design,01/08/2025",
  ",Cy See,BU22CSE002,cy@gitam.in,,,31/02/2025",
].join("\n"));
ok("a typical club sheet: extra columns are ignored, and the page is told which column was read for what", sheet.problem === null && sheet.rows[0].email === "BEA@gitam.in" && sheet.rows[0].handle === "bea-b" && sheet.rows[0].team === "Design"
  && sheet.columns.map((x) => `${x.field}<-${x.from}`).join() === "handle<-GitHub Username,name<-Name of the student,email<-Email ID,team<-Domain,joined_on<-Date of joining");
ok("dates written day-first are read; impossible ones are left empty, with a note", sheet.rows[0].joined_on === "2025-08-01" && sheet.rows[1].joined_on === "" && sheet.notes.length === 1);
ok("toIsoDate: ISO, day-first with / . or -, and Excel's day numbers", toIsoDate("2025-08-01") === "2025-08-01" && toIsoDate("1.8.2025") === "2025-08-01" && toIsoDate("45870") === "2025-08-01" && toIsoDate("next week") === null && toIsoDate("") === "");
const noEmail = parseMembersTable([["Name", "Phone"], ["Ada", "123"]]);
ok("a file without a name or email column says which one is missing", noEmail.problem?.includes("email") === true && noEmail.rows.length === 0);

const m = (over: Partial<Member>): Member => ({ id: "1", handle: "ada", name: "Ada", email: "ada@gitam.in", team: "Tech", joined_on: "2025-08-01", status: "active", status_since: "2025-08-01", left_on: null, created_at: "", user_id: null, source_application_id: null, ...over });
const out = membersCsv([m({}), m({ name: "=HYPERLINK(\"http://evil\")", handle: null as unknown as string, team: null as unknown as string })]);
ok("the export has a header and one line per member", out.split("\n").length === 3 && out.startsWith("handle,name,email,team,status,joined_on,left_on"));
ok("a cell that starts with = is neutralised so a spreadsheet won't run it", out.includes(`"'=HYPERLINK(""http://evil"")"`) && !out.includes(`,"=HYPERLINK`));

// an Excel file, made here the way Excel stores one: a zip of XML files, one of them deflated, with shared strings,
// inline strings, a formula's text result, a skipped cell, and the first sheet stored under another name
(async () => {
  const entries: [string, string, boolean][] = [
    ["xl/workbook.xml", '<workbook><sheets><sheet name="Members" sheetId="1" r:id="rId7"/></sheets></workbook>', false],
    ["xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/sheet3.xml"/></Relationships>', false],
    ["xl/sharedStrings.xml", "<sst><si><t>Name</t></si><si><t>Email ID</t></si><si><t>GitHub</t></si><si><r><t>Ada </t></r><r><t>Lovelace</t></r></si><si><t>ada@gitam.in</t></si><si><t>Tom &amp; Jerry</t></si></sst>", true],
    ["xl/worksheets/sheet3.xml", '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="inlineStr"><is><t>Joined</t></is></c></row>'
      + '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="D2"><v>45870</v></c></row>'
      + '<row r="3"><c r="A3" t="s"><v>5</v></c><c r="B3" t="str"><v>tj@gitam.in</v></c><c r="C3" t="inlineStr"><is><t>@tj</t></is></c></row></sheetData></worksheet>', false],
  ];
  const parts: Buffer[] = [], central: Buffer[] = []; let off = 0;
  for (const [name, xml, deflate] of entries) {
    const raw = Buffer.from(xml), data = deflate ? deflateRawSync(raw) : raw, n = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(deflate ? 8 : 0, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(deflate ? 8 : 0, 10); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(off, 42);
    parts.push(local, n, data); central.push(cen, n); off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  const file = Buffer.concat([...parts, cd, eocd]);
  const table = await readXlsx(file.buffer.slice(file.byteOffset, file.byteOffset + file.length) as ArrayBuffer);
  const x = parseMembersTable(table);
  ok("an Excel file is read: the first sheet wherever it's stored, shared and inline strings, styled runs, skipped cells", table.length === 3 && x.rows[0].name === "Ada Lovelace" && x.rows[0].handle === "" && x.rows[1].name === "Tom & Jerry" && x.rows[1].email === "tj@gitam.in" && x.rows[1].handle === "tj");
  ok("…and its date numbers become dates", x.rows[0].joined_on === "2025-08-01");
  let notZip = false; try { await readXlsx(new TextEncoder().encode("name,email").buffer as ArrayBuffer); } catch { notZip = true; }
  ok("a file that isn't really Excel is refused, not misread", notZip);
  console.log(fails ? `\n${fails} FAILED` : "\nall members-csv checks passed"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL  crashed:", e); process.exit(1); });
