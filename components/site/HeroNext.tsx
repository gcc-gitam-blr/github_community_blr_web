"use client";
import Link from "next/link";
import { useClientValue } from "@/lib/useClientValue";
import { EVENTS, eventSlug, lastEvent, nextEvent, todayInIndia, type ClubEvent } from "@/lib/events";

/* The first thing a student wants to know, right under the headline: what's on next, when, and how to come;
   then the last session that has a recap, as proof the club really meets. Worked out in the browser, so it's right
   on the day (the page itself is built once per deploy). */
export function HeroNext() {
  const date = useClientValue(() => nextEvent(todayInIndia())?.event.date ?? "", null);
  const lastDate = useClientValue(() => lastEvent(todayInIndia())?.date ?? "", null);
  const e = date ? EVENTS.find((x) => x.date === date) : undefined;
  const last = lastDate ? EVENTS.find((x) => x.date === lastDate) : undefined;
  if (!e) return last ? <HeroLast e={last} /> : <p className="min-h-[28px]" aria-hidden />;
  const days = nextEvent(todayInIndia())?.days ?? 0;
  const when = e.dateLabel ?? new Date(`${e.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const soon = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return (
    <>
      <p className="flex min-h-[28px] flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-2">
        <span className="inline-flex items-center gap-2 font-mono text-[12.5px] font-semibold uppercase tracking-[.08em] text-[#116329]"><span aria-hidden className="h-2 w-2 rounded-full bg-[#2da44e]" />Next</span>
        <Link href={e.href ?? `/events/${eventSlug(e)}`} className="font-semibold text-ink underline-offset-4 hover:underline">{e.title}</Link>
        <span>{when}{e.dateLabel ? "" : `, ${soon}`} · {e.where}</span>
        {e.luma && <a href={e.luma} target="_blank" rel="noopener" className="font-semibold text-link underline-offset-4 hover:underline">RSVP <span aria-hidden>↗</span></a>}
      </p>
      {last && <HeroLast e={last} />}
    </>
  );
}

/** "Last  GitHub 101 · 28 attendees · Recap": what already happened, quieter than "Next". */
function HeroLast({ e }: { e: ClubEvent }) {
  const n = e.recap?.numbers?.[0];
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-2">
      <span className="inline-flex items-center gap-2 font-mono text-[12.5px] font-semibold uppercase tracking-[.08em] text-ink-3"><span aria-hidden className="h-2 w-2 rounded-full border-[1.5px] border-ink-3" />Last</span>
      <span className="font-semibold text-ink">{e.title}</span>
      {n && <span>{n.value} {n.label.toLowerCase()}</span>}
      <Link href={`/events/${eventSlug(e)}#recap`} className="font-semibold text-link underline-offset-4 hover:underline">{e.recap?.video ? "Watch the recap" : "Read the recap"} <span aria-hidden>→</span></Link>
    </p>
  );
}
