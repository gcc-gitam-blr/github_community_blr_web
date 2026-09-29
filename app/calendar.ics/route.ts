import { CLUB } from "@/lib/config";

/* The year's events as an iCalendar file — import once, get every event in Google/Apple/Outlook calendar. */
export const dynamic = "force-static";

const esc = (s: string) => s.replace(/[\;,]/g, (c) => "\\" + c).replace(/\n/g, "\n");
const ymd = (iso: string) => iso.replace(/-/g, "");
const nextDay = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
const monthEnd = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1, 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };

export function GET() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const events = CLUB.events.map((e) => [
    "BEGIN:VEVENT",
    `UID:${ymd(e.date)}-${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@github-community-blr`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(e.date)}`,
    // Epoch only has a month so far: block out the whole month until dates are announced
    `DTEND;VALUE=DATE:${e.dateLabel ? monthEnd(e.date) : nextDay(e.date)}`,
    `SUMMARY:${esc(e.title)}${e.dateLabel ? " (dates TBA)" : ""}`,
    `DESCRIPTION:${esc(e.text)}`,
    `LOCATION:${esc(e.where)}`,
    "END:VEVENT",
  ].join("\r\n"));
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GitHub Community Club BLR//Events//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:GitHub Community Club · ${CLUB.year}`, ...events, "END:VCALENDAR", ""].join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="github-community-club-2026-27.ics"' } });
}
