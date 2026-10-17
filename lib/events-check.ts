/* Which upcoming events have no approved proposal behind them. The public event pages are written in the content editor
   (a git commit), which the database can't hold back, so this is a reminder, not a gate: `npm run check:events` prints
   a warning for each one and CI shows it, but never fails. */
export interface EventLike { title: string; date: string; dateLabel?: string | null; proposalId?: number | null }

/** Events on or after `today` (YYYY-MM-DD, India) that don't say which proposal approved them. */
export const eventsMissingProposal = (events: EventLike[], today: string) =>
  events.filter((e) => e.date >= today && !e.proposalId).sort((a, b) => a.date.localeCompare(b.date));

export const warningFor = (e: EventLike) =>
  `"${e.title}" (${e.dateLabel || e.date}) has no proposal number. Propose it under Admin → Event proposals, get it approved, then add the number to the event in the content editor.`;
