/* Dates and wording for appointments (/admin → People & roles). The database decides who has access; this only
   helps the page say it clearly. All dates are India dates, like the database's today_ist(). */
export type AccessRole = "volunteer" | "core" | "admin";
export const ROLE_LABEL: Record<"attendee" | AccessRole, string> = { attendee: "No access", volunteer: "Volunteer", core: "Core team", admin: "Admin" };
export const ROLE_HELP: Record<AccessRole, string> = {
  volunteer: "Event-day help only: attendance and certificates, the Epoch desk and booths, the timer and quizzes. Not for the core team.",
  core: "The core team: everything a volunteer has, plus sign-ups, messages, feedback, members, recruitment, projects, event proposals, tasks, meetings, assets and policies.",
  admin: "President and vice-president: everything, plus giving and ending access, sending emails, approving events and publishing policies.",
};
export const SOON_DAYS = 14; // the Monday digest and this page warn when access ends within this many days
export const MAX_DAYS = 1100; // the database refuses a longer term (about 3 years)

export const todayIST = (now = Date.now()) => new Date(now + 330 * 60_000).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10);
/** Whole days from today (India) to the end date; 0 = ends today, negative = already over. */
export const daysLeft = (endsOn: string, now = Date.now()) => Math.round((Date.parse(endsOn) - Date.parse(todayIST(now))) / 864e5);
export const endsLabel = (endsOn: string, now = Date.now()) => {
  const d = daysLeft(endsOn, now);
  return d < 0 ? "ended" : d === 0 ? "ends today" : d === 1 ? "ends tomorrow" : `ends in ${d} days`;
};
export const endsSoon = (endsOn: string, now = Date.now()) => daysLeft(endsOn, now) <= SOON_DAYS;
export const niceDate = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
