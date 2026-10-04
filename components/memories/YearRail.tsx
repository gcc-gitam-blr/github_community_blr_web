"use client";
import { useEffect, useState } from "react";

/* The side rail on wide screens: the club's history as one branch, a commit per year, then the thank-you and you.
   The year you're reading is HEAD (filled green); years behind it are history, the ones ahead are still hollow. */
export interface Stop { id: string; label: string; hint?: string; next?: boolean }

export function YearRail({ stops }: { stops: Stop[] }) {
  const [head, setHead] = useState(0);
  useEffect(() => {
    const els = stops.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    // the section crossing a line 40% down the screen is the one being read
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) setHead(stops.findIndex((s) => s.id === e.target.id)); }), { rootMargin: "-40% 0px -59% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [stops]);

  return (
    <nav aria-label="Years" className="sticky top-[112px] hidden lg:block">
      <p className="font-mono text-[12.5px] text-ink-3">git log --reverse</p>
      <ol className="relative mt-5">
        {stops.map((s, i) => {
          const past = i < head, now = i === head;
          return (
            <li key={s.id} className="relative pb-6 last:pb-0">
              {i < stops.length - 1 && <span aria-hidden className={`absolute left-[5px] top-[14px] h-[calc(100%-2px)] w-[2px] ${stops[i + 1].next ? "bg-[repeating-linear-gradient(180deg,rgba(11,11,15,.3)_0_4px,transparent_4px_8px)]" : past ? "bg-ink" : "bg-line"} transition-colors duration-300`} />}
              <a href={`#${s.id}`} aria-current={now ? "location" : undefined} className="group relative flex items-start gap-3 rounded-md">
                <span aria-hidden className={`mt-[3px] h-3 w-3 flex-none rounded-full border-2 transition-[background-color,border-color,box-shadow] duration-200 ${s.next ? "border-dashed border-ink/50 bg-white" : now ? "border-[#1a7f37] bg-[#2da44e] shadow-[0_0_0_4px_rgba(45,164,78,.2)]" : past ? "border-ink bg-ink" : "border-ink bg-white"}`} />
                <span className="min-w-0">
                  <span className={`block font-mono text-[13.5px] leading-tight transition-colors duration-150 group-hover:text-ink ${now ? "font-semibold text-ink" : "text-ink-2"}`}>{s.label}</span>
                  {s.hint && <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">{s.hint}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
