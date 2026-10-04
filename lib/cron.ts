import { createHash, timingSafeEqual } from "node:crypto";

/* Vercel cron jobs (vercel.json "crons") call with "Authorization: Bearer <CRON_SECRET>". No secret set = refused. */
const digest = (s: string) => createHash("sha256").update(s).digest(); // equal lengths, so the comparison takes the same time
export const cronAuthorized = (header: string | null, secret = process.env.CRON_SECRET) =>
  !!secret && !!header && timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
