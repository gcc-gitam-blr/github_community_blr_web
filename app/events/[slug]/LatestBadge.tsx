"use client";
import { todayISO, useClientValue } from "@/lib/useClientValue";
import { EVENTS } from "@/lib/events";

/* GitHub-style release badge: "Next up" for the soonest upcoming event, "Past" once it's done. */
export function LatestBadge({ date, flagship }: { date: string; flagship: boolean }) {
  const today = useClientValue(todayISO, "");
  const next = today ? EVENTS.find((e) => e.date >= today)?.date : undefined;
  const past = today && date < today && !flagship;
  const base = "rounded-full border px-2.5 py-0.5 text-[12px] font-semibold";
  return (
    <span className="flex gap-2">
      {flagship && <span className={`${base} border-[#d4a72c] bg-[#fff8c5] text-[#7d4e00]`}>Flagship</span>}
      {date === next && <span className={`${base} border-[#2ea043] text-[#1a7f37]`}>Next up</span>}
      {past && <span className={`${base} border-line text-ink-3`}>Past</span>}
    </span>
  );
}
