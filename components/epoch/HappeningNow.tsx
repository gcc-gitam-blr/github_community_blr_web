"use client";
import Link from "next/link";
import { EPOCH, SCHEDULE } from "@/lib/epoch/config";
import { happening, istTime, laterDay, untilLabel, type Happening, type Slot } from "@/lib/epoch/happening";
import { useNow } from "@/lib/epoch/live";

/* "Happening now" during Epoch: what's on and what's next, from the schedule, in India time.
   Nothing time-based shows until the real start date is set (EPOCH.startsAt), and nothing after Epoch ends. */

/** What's on at this minute, and the minute itself; "unset" during the server render, so nothing flashes in before the clock is known. */
export function useHappening(step = 30_000): { h: Happening; now: number } {
  const now = useNow(step);
  return { h: now ? happening(SCHEDULE, EPOCH.startsAt, now) : { phase: "unset" }, now };
}

const SOON = 36 * 36e5; // before Epoch, the panel appears in the last day and a half

const Line = ({ s, until }: { s: Slot; until?: boolean }) => (
  <li className="flex items-baseline gap-3">
    <span className="w-[52px] shrink-0 text-[15px] tabular-nums text-mute">{istTime(s.start)}</span>
    <span className="min-w-0 text-[19px] font-medium leading-snug tracking-[-0.02em]">{s.title}{until && <span className="ml-2 text-[14px] font-normal text-mute">until {istTime(s.end)}</span>}</span>
  </li>
);

export function HappeningNow() {
  const { h, now } = useHappening();
  if (h.phase === "unset" || h.phase === "after" || (h.phase === "before" && h.startsIn > SOON)) return null;
  const next = h.next, nextDay = h.phase === "on" && next.length > 0 && laterDay(next[0].start, now);
  return (
    <section aria-labelledby="now-h" className="mx-auto w-full max-w-[1120px] px-6 pb-[clamp(40px,6vw,72px)] md:px-10">
      <div aria-live="polite" className="grid gap-6 rounded-[22px] border border-ink/10 bg-white p-6 shadow-[0_14px_30px_-22px_rgba(11,11,15,.35)] sm:grid-cols-2 sm:p-8">
        {h.phase === "on" ? (
          <div>
            <h2 id="now-h" className="flex items-center gap-2 text-[13px] text-mute"><span className="h-2 w-2 animate-pulse rounded-full bg-[#1a7f37] motion-reduce:animate-none" aria-hidden />Happening now · Day {h.day}</h2>
            {h.now.length ? <ul className="mt-3 space-y-2">{h.now.map((s) => <Line key={s.start + s.title} s={s} until />)}</ul> : <p className="mt-3 text-[19px] text-mute">A short gap between sessions.</p>}
          </div>
        ) : (
          <div>
            <h2 id="now-h" className="text-[13px] text-mute">Epoch starts {untilLabel(h.startsIn)}</h2>
            <p className="mt-3 text-[19px] font-medium tracking-[-0.02em]">Got your wallet? <Link href="/epoch/register" className="underline underline-offset-4">Get your ticket</Link> before you arrive.</p>
          </div>
        )}
        {next.length > 0 && (
          <div>
            <h3 className="text-[13px] text-mute">{h.phase === "before" ? "First up" : nextDay ? "Tomorrow, first up" : `Next, ${untilLabel(next[0].start - now)}`}</h3>
            <ul className="mt-3 space-y-2">{next.map((s) => <Line key={s.start + s.title} s={s} />)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
