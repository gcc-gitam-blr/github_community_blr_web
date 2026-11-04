import type { SendResult } from "./send";

/* Sending many emails the way a person would: one at a time, a few seconds apart, never in a burst. A burst of near-
   identical emails from one Gmail account is one of the clearest signs of a mass mailing, and one of the things that
   sends a whole batch to spam. A function on Vercel runs for at most a minute, so each call sends what fits in about
   45 seconds and says how many are left; the admin page calls again until everyone has theirs. Who already got it is
   recorded after each email (by the caller's `onSent`), so a closed tab or a paused send never emails anyone twice. */

/** The pause between two emails: 4 to 8 seconds by default, a little different each time. EMAIL_GAP_MS sets the base (0 in tests). */
export function gapMs(): number {
  const base = Number(process.env.EMAIL_GAP_MS ?? 4000);
  return base > 0 ? Math.round(base + Math.random() * base) : 0;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PacedResult { sent: number; left: number; problem?: string }

/** Sends to each item in order until the time runs out. The first failure stops the run (a daily limit, a refused
    login, a mail server slowing us down), so nothing is hammered; the rest wait for the next call. */
export async function sendPaced<T>(items: T[], send: (item: T) => Promise<SendResult>, onSent: (item: T) => Promise<void>, until: number): Promise<PacedResult> {
  let sent = 0;
  for (const [n, item] of items.entries()) {
    if (Date.now() >= until) return { sent, left: items.length - n };
    const res = await send(item);
    if (!res.sent) {
      console.error("paced send stopped:", res.reason === "failed" ? res.error : res.reason);
      return { sent, left: items.length - n, problem: res.reason === "failed" ? res.why : "Email isn't set up yet." };
    }
    await onSent(item);
    sent++;
    const pause = gapMs();
    if (n < items.length - 1 && pause) { if (Date.now() + pause >= until) return { sent, left: items.length - n - 1 }; await wait(pause); }
  }
  return { sent, left: 0 };
}
