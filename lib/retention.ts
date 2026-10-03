/* How long the club keeps each kind of personal data. The database deletes anything older every week
   (prune_old_data in supabase/schema.sql, run by the Vercel cron in vercel.json) and /privacy quotes
   these numbers. SQL can't import this file, so tests/schema.test.ts checks the two agree: change both. */
export const RETENTION = {
  signUpsMonths: 18, // long enough to cover a whole club year after someone joins
  messagesMonths: 12, // Get involved messages
  feedbackMonths: 12, // anonymous event feedback
  errorsDays: 30, // error reports from browsers
} as const;
