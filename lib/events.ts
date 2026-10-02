import { CLUB } from "./config";

/* Helpers for the club's events: stable URLs, ordering, and iCalendar output. */
export type ClubEvent = (typeof CLUB.events)[number];

export const eventSlug = (e: ClubEvent) => e.title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const EVENTS = [...CLUB.events].sort((a, b) => a.date.localeCompare(b.date));
export const findEvent = (slug: string) => EVENTS.find((e) => eventSlug(e) === slug);
/** "v2026.10.05" — every event is a release of the club */
export const eventTag = (e: ClubEvent) => "v" + e.date.replace(/-/g, ".");
export const eventDate = (e: ClubEvent) => e.dateLabel ?? new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const esc = (s: string) => s.replace(/[\;,]/g, (c) => "\\" + c).replace(/\n/g, "\n");
const ymd = (iso: string) => iso.replace(/-/g, "");
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
const monthEnd = (iso: string) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1, 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };

/** An iCalendar (.ics) file for one or more events — all-day entries; Epoch blocks its month until dates are set. */
export function icsFor(events: ClubEvent[], name: string, url?: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const body = events.map((e) => [
    "BEGIN:VEVENT",
    `UID:${ymd(e.date)}-${eventSlug(e)}@github-community-blr`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(e.date)}`,
    `DTEND;VALUE=DATE:${e.dateLabel ? monthEnd(e.date) : addDays(e.date, 1)}`,
    `SUMMARY:${esc(e.title)}${e.dateLabel ? " (dates TBA)" : ""}`,
    `DESCRIPTION:${esc(e.text)}`,
    `LOCATION:${esc(e.where)}`,
    ...(url ? [`URL:${url}/events/${eventSlug(e)}`] : []),
    "END:VEVENT",
  ].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GitHub Community Club BLR//Events//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(name)}`, ...body, "END:VCALENDAR", ""].join("\r\n");
}

export const icsResponse = (ics: string, filename: string) =>
  new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });

/** The next event on or after `today` (YYYY-MM-DD), and how many days away it is. */
export function nextEvent(today: string): { event: ClubEvent; days: number } | null {
  const e = EVENTS.find((x) => x.date >= today);
  if (!e) return null;
  return { event: e, days: Math.round((Date.parse(e.date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5) };
}
