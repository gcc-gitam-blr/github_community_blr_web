import { githubHandle, parseCsv } from "@/lib/attendance";

/* Members: reading an import file, and writing an export. The database checks every row again (import_members in
   supabase/schema.sql), so this only turns a spreadsheet into rows and says what is missing before anything is sent. */
export interface MemberRow { handle: string; name: string; email: string; team: string; joined_on: string }
export interface Member extends MemberRow { id: string; status: "active" | "alumni" | "inactive"; status_since: string; left_on: string | null; created_at: string; user_id: string | null; source_application_id: number | null }
export const MEMBER_COLUMNS = ["handle", "name", "email", "team", "joined_on"] as const;
export const MAX_IMPORT = 500;

/** A spreadsheet pasted or exported as CSV: a header row naming the columns (any order), then one member per line. */
export function parseMembersCsv(text: string): { rows: MemberRow[]; problem: string | null } {
  const table = parseCsv(text.replace(/^﻿/, "")).filter((r) => r.some((c) => c.trim()));
  if (!table.length) return { rows: [], problem: "The file is empty." };
  const head = table[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (name: string) => head.indexOf(name);
  if (col("name") < 0 || col("email") < 0) return { rows: [], problem: "The first line must name the columns, and include at least name and email (handle, team and joined_on are optional)." };
  if (table.length - 1 > MAX_IMPORT) return { rows: [], problem: `Import at most ${MAX_IMPORT} people at a time.` };
  const cell = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
  const rows = table.slice(1).map((r) => ({ handle: githubHandle(cell(r, "handle")) ?? cell(r, "handle"), name: cell(r, "name"), email: cell(r, "email"), team: cell(r, "team"), joined_on: cell(r, "joined_on") }));
  return { rows, problem: rows.length ? null : "There are no people under the header line." };
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
/** The export file. Cells starting with = + - @ are prefixed so a spreadsheet never runs them as formulas. */
export const membersCsv = (rows: Member[]) => [
  "handle,name,email,team,status,joined_on,left_on",
  ...rows.map((m) => [m.handle ?? "", m.name, m.email, m.team ?? "", m.status, m.joined_on ?? "", m.left_on ?? ""].map((c) => q(/^[=+\-@]/.test(String(c)) ? `'${c}` : String(c))).join(",")),
].join("\n");
