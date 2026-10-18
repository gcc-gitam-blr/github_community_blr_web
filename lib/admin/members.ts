import { githubHandle, parseCsv } from "@/lib/attendance";

/* Members: reading an import file, and writing an export. The database checks every row again (import_members in
   supabase/schema.sql), so this only turns a spreadsheet into rows and says what is missing before anything is sent.
   Real sheets don't use our column names, so columns are found by what they're called in practice ("Email ID",
   "GitHub Username", "Full name", "Domain"…), and the page shows which column it read for what. */
export interface MemberRow { handle: string; name: string; email: string; team: string; joined_on: string }
export interface Member extends MemberRow { id: string; status: "active" | "alumni" | "inactive"; status_since: string; left_on: string | null; created_at: string; user_id: string | null; source_application_id: number | null }
export const MEMBER_COLUMNS = ["handle", "name", "email", "team", "joined_on"] as const;
export const MAX_IMPORT = 500;
export type Parsed = { rows: MemberRow[]; problem: string | null; columns: { field: (typeof MEMBER_COLUMNS)[number]; from: string }[]; notes: string[] };

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Which header is which field: an exact name first, then the words people use. */
const FIND: Record<(typeof MEMBER_COLUMNS)[number], (k: string) => boolean> = {
  email: (k) => k.includes("email") || k.includes("mail"),
  handle: (k) => k === "handle" || k.includes("github") || k === "username" || k === "ghusername" || k === "gitusername",
  name: (k) => ["name", "fullname", "studentname", "membername", "yourname", "nameofthestudent", "nameofthemember", "participantname"].includes(k) || (k.includes("name") && !k.includes("user") && !k.includes("github") && !k.includes("team") && !k.includes("event") && !k.includes("college")),
  team: (k) => ["team", "domain", "wing", "vertical", "department", "dept", "teamname", "domaininterested"].includes(k) || k.startsWith("team") || k.startsWith("domain"),
  joined_on: (k) => k.includes("joined") || k === "joindate" || k === "dateofjoining" || k === "joiningdate",
};

/** A date the way sheets write it: 2025-08-01, 01/08/2025 or 1-8-2025 (day first, as in India), or Excel's day number. */
export function toIsoDate(v: string): string | null {
  const s = v.trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const iso = (y: number, mo: number, d: number) => { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null; };
  if (m) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return iso(+m[3], +m[2], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) { const n = Math.floor(Number(s)); if (n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10); }
  return null;
}

/** A sheet, as rows of cells: a header row naming the columns (any order, any wording), then one member per row. */
export function parseMembersTable(input: string[][]): Parsed {
  const table = input.filter((r) => r.some((c) => (c ?? "").trim()));
  const none: Parsed = { rows: [], problem: null, columns: [], notes: [] };
  if (!table.length) return { ...none, problem: "The file is empty." };
  const head = table[0].map((h) => (h ?? "").trim()), keys = head.map(key);
  const used = new Set<number>(), col = {} as Record<(typeof MEMBER_COLUMNS)[number], number>;
  for (const field of ["email", "handle", "name", "team", "joined_on"] as const) {
    const exact = keys.findIndex((k, i) => !used.has(i) && k === key(field));
    const i = exact >= 0 ? exact : keys.findIndex((k, j) => !used.has(j) && FIND[field](k));
    col[field] = i; if (i >= 0) used.add(i);
  }
  const columns = MEMBER_COLUMNS.filter((f) => col[f] >= 0).map((f) => ({ field: f, from: head[col[f]] }));
  if (col.name < 0 || col.email < 0) return { ...none, columns, problem: `We couldn't find a ${col.name < 0 ? "name" : "email"} column. The first row should name the columns: at least a name and an email (a GitHub username, team and joined date are optional).` };
  if (table.length - 1 > MAX_IMPORT) return { ...none, columns, problem: `Import at most ${MAX_IMPORT} people at a time.` };
  const cell = (r: string[], f: (typeof MEMBER_COLUMNS)[number]) => (col[f] >= 0 ? (r[col[f]] ?? "").trim() : "");
  let badDates = 0;
  const rows = table.slice(1).map((r) => {
    const raw = cell(r, "joined_on"), d = toIsoDate(raw);
    if (d === null) badDates++;
    return { handle: githubHandle(cell(r, "handle")) ?? cell(r, "handle"), name: cell(r, "name"), email: cell(r, "email"), team: cell(r, "team").slice(0, 40), joined_on: d ?? "" };
  });
  const notes = badDates ? [`${badDates} joined date${badDates === 1 ? " wasn't" : "s weren't"} recognised and will be left empty.`] : [];
  return { rows, columns, notes, problem: rows.length ? null : "There are no people under the header row." };
}

export const parseMembersCsv = (text: string): Parsed => parseMembersTable(parseCsv(text.replace(/^﻿/, "")));

/** One CSV cell, quoted. A cell starting with = + - @ gets a leading ' so a spreadsheet never runs it as a formula. */
export const csvCell = (v: unknown) => { const s = String(v ?? ""); return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
/** The export file. */
export const membersCsv = (rows: Member[]) => [
  "handle,name,email,team,status,joined_on,left_on",
  ...rows.map((m) => [m.handle, m.name, m.email, m.team, m.status, m.joined_on, m.left_on].map(csvCell).join(",")),
].join("\n");
