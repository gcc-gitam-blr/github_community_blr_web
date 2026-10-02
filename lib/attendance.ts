/* Who came to an event. Organisers import Luma's guest list (Event → Guests → Export as CSV); only people
   Luma checked in at the door count. Pure functions, so the import is tested without a browser. */
export interface Attendee { name: string; email: string; handle?: string }
export interface Import { attendees: Attendee[]; skipped: { notCheckedIn: number; noEmail: number; duplicate: number }; hasCheckIn: boolean }

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
/** A GitHub handle from "@ada", "ada" or "https://github.com/ada". */
export const githubHandle = (v: string) => { const h = v.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, ""); return HANDLE.test(h) ? h : undefined; };

export function fromLumaCsv(text: string): Import {
  const [head = [], ...rows] = parseCsv(text);
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h.trim().toLowerCase()));
  const iName = col("name", "full name", "guest name"), iFirst = col("first_name", "first name"), iLast = col("last_name", "last name");
  const iEmail = col("email", "email address"), iChecked = col("checked_in_at", "checked in at", "checked in", "check-in time");
  const iStatus = col("approval_status", "status");
  const iGh = head.findIndex((h) => /github/i.test(h)); // a custom question like "Your GitHub username"
  const skipped = { notCheckedIn: 0, noEmail: 0, duplicate: 0 }, seen = new Set<string>(), attendees: Attendee[] = [];
  for (const r of rows) {
    const email = (r[iEmail] ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) { skipped.noEmail++; continue; }
    const checked = iChecked >= 0 ? !!(r[iChecked] ?? "").trim() && !/^(no|false|0)$/i.test(r[iChecked].trim()) : (iStatus < 0 || /approved|going|checked/i.test(r[iStatus] ?? ""));
    if (!checked) { skipped.notCheckedIn++; continue; }
    if (seen.has(email)) { skipped.duplicate++; continue; }
    seen.add(email);
    const name = ((iName >= 0 ? r[iName] : "") || [r[iFirst] ?? "", r[iLast] ?? ""].join(" ")).replace(/\s+/g, " ").trim() || email.split("@")[0];
    attendees.push({ name: name.slice(0, 80).padEnd(2, "."), email, handle: iGh >= 0 ? githubHandle(r[iGh] ?? "") : undefined });
  }
  return { attendees, skipped, hasCheckIn: iChecked >= 0 };
}

/** One person typed in by hand: "Ada Lovelace, ada@gitam.in" (GitHub handle optional, third). */
export function fromLine(line: string): Attendee | null {
  const [name = "", email = "", gh = ""] = line.split(/[,\t;]/).map((x) => x.trim());
  if (name.length < 2 || !EMAIL.test(email)) return null;
  return { name: name.slice(0, 80), email: email.toLowerCase(), handle: githubHandle(gh) };
}
