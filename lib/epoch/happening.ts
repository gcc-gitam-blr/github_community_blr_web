import type { SessionItem } from "./config";

/* "Happening now" at Epoch. The schedule's times are India time (IST, UTC+5:30, no daylight saving),
   so everything here works in absolute milliseconds and never uses the visitor's own time zone.
   Day 1 is the date in India that EPOCH.startsAt falls on; Day 2 is the day after. No startsAt, nothing time-based. */

export const IST = 330 * 60_000; // India's offset from UTC
const DAY = 864e5, HOUR = 36e5;

type Day = { day: 1 | 2; label: string; items: SessionItem[] };
export interface Slot extends Omit<SessionItem, "end"> { day: 1 | 2; label: string; start: number; end: number } // start and end as real moments (UTC ms)
export type Happening =
  | { phase: "unset" }
  | { phase: "before"; next: Slot[]; startsIn: number }
  | { phase: "on"; day: 1 | 2; now: Slot[]; next: Slot[] }
  | { phase: "after" };

/** Midnight (as UTC ms) of the date in India that `t` falls on. */
const istMidnight = (t: number) => Math.floor((t + IST) / DAY) * DAY;
const clock = (dayStart: number, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return dayStart + (h * 60 + m) * 60_000 - IST; };

/** Every session as real moments in time, in order. Empty when the start date isn't announced. */
export function slots(schedule: Day[], startsAt: string): Slot[] {
  const t = startsAt ? Date.parse(startsAt) : NaN;
  if (isNaN(t)) return [];
  const base = istMidnight(t);
  return schedule.flatMap((d) => {
    const dayStart = base + (d.day - 1) * DAY;
    const starts = d.items.map((i) => clock(dayStart, i.time)).sort((a, b) => a - b);
    return d.items.map((i) => {
      const start = clock(dayStart, i.time);
      // no end time: it runs until the next session starts (or an hour, if it's the last)
      const end = i.end ? clock(dayStart, i.end) : starts.find((s) => s > start) ?? start + HOUR;
      return { ...i, day: d.day, label: d.label, start, end: end > start ? end : start + HOUR };
    });
  }).sort((a, b) => a.start - b.start || a.end - b.end);
}

/** What's on at `now`, and what starts next (every session sharing the next start time). */
export function happening(schedule: Day[], startsAt: string, now: number): Happening {
  const all = slots(schedule, startsAt);
  if (!all.length) return { phase: "unset" };
  const nextStart = all.find((s) => s.start > now)?.start;
  const next = nextStart === undefined ? [] : all.filter((s) => s.start === nextStart);
  if (now < all[0].start) return { phase: "before", next, startsIn: all[0].start - now };
  if (now >= Math.max(...all.map((s) => s.end))) return { phase: "after" };
  const day = (istMidnight(now) > istMidnight(all[0].start) ? 2 : 1) as 1 | 2;
  return { phase: "on", day, now: all.filter((s) => s.start <= now && now < s.end), next };
}

/** "08:30" for a moment, in India time. */
export const istTime = (t: number) => { const d = new Date(t + IST); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };

/** "in 25 min", "in 2 h 10 min", "in 3 days": how long until `ms` from now. */
export function untilLabel(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `in ${min} min`;
  if (min < 24 * 60) { const h = Math.floor(min / 60), m = min % 60; return `in ${h} h${m ? ` ${m} min` : ""}`; }
  const days = Math.round(min / (24 * 60));
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Whether `a` is on a later date in India than `b` ("tomorrow" for the next session). */
export const laterDay = (a: number, b: number) => istMidnight(a) > istMidnight(b);
