import type { ClubMessage, EventFeedback, JoinRequest } from "./epoch/types";

/* The organiser desk's "Club at a glance": plain counts from rows the desk already reads. Pure, so it's tested. */
export interface ClubStats {
  signUps: number;
  thisWeek: number;
  /** sign-ups per week, oldest first; the last entry is the current week (weeks start Monday) */
  weeks: { start: string; count: number }[];
  /** how many picked each event as the first thing they want to try, most popular first */
  firstEvents: { event: string; count: number }[];
  messages: { kind: string; count: number }[];
  newMessages: number;
  feedback: { count: number; average: number | null };
}

const DAY = 86_400_000;
/** Monday 00:00 (local time) of the week containing `d` */
export const weekStart = (d: Date) => { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const tally = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].map(([k, count]) => ({ k, count })).sort((a, b) => b.count - a.count || a.k.localeCompare(b.k));

export function clubStats(joins: JoinRequest[], messages: ClubMessage[], feedback: EventFeedback[], now = new Date(), nWeeks = 8): ClubStats {
  const current = weekStart(now).getTime();
  const weeks = Array.from({ length: nWeeks }, (_, i) => {
    const start = new Date(current); start.setDate(start.getDate() - (nWeeks - 1 - i) * 7); // setDate keeps local midnight across DST
    return { start: ymd(start), from: start.getTime(), count: 0 };
  });
  for (const j of joins) {
    const t = new Date(j.createdAt).getTime();
    const w = weeks.findLast((x) => t >= x.from);
    if (w && t < current + 7 * DAY) w.count++;
  }
  const weekAgo = now.getTime() - 7 * DAY;
  const ratings = feedback.map((f) => f.rating).filter((r) => r >= 1 && r <= 5);
  return {
    signUps: joins.length,
    thisWeek: joins.filter((j) => new Date(j.createdAt).getTime() >= weekAgo).length,
    weeks: weeks.map(({ start, count }) => ({ start, count })),
    firstEvents: tally(joins.map((j) => j.firstEvent)).map(({ k, count }) => ({ event: k, count })),
    messages: tally(messages.map((m) => m.kind)).map(({ k, count }) => ({ kind: k, count })),
    newMessages: messages.filter((m) => new Date(m.createdAt).getTime() >= weekAgo).length,
    feedback: { count: ratings.length, average: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null },
  };
}
