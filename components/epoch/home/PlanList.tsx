"use client";
import { useState } from "react";
import { SCHEDULE } from "@/lib/epoch/config";
import { useHappening } from "../HappeningNow";

/* The two-day plan as a plain agenda: time, title, one muted line. During Epoch it opens on today and marks what's on. */
export function PlanList() {
  const { h } = useHappening();
  const [picked, setDay] = useState<1 | 2 | null>(null);
  const day = picked ?? (h.phase === "on" ? h.day : 1); // today's tab during Epoch, until someone picks one
  const on = new Set(h.phase === "on" ? h.now.map((s) => `${s.day} ${s.time} ${s.title}`) : []);
  const d = SCHEDULE.find((s) => s.day === day)!;
  return (
    <div>
      <div role="tablist" aria-label="Day" className="mb-8 inline-flex rounded-full border border-hair bg-white/50 p-1 backdrop-blur">
        {SCHEDULE.map((s) => (
          <button key={s.day} role="tab" aria-selected={day === s.day} onClick={() => setDay(s.day)} className={`rounded-full px-6 py-2.5 text-[15px] transition ${day === s.day ? "bg-ink text-white" : "text-mute hover:text-ink"}`}>{s.label}</button>
        ))}
      </div>
      <ol className="border-t border-hair">
        {d.items.map((it, i) => (
          <li key={i} aria-current={on.has(`${day} ${it.time} ${it.title}`) ? "time" : undefined} className={`grid grid-cols-[84px_1fr] gap-x-5 border-b border-hair py-5 sm:grid-cols-[130px_1fr_100px] ${it.kind === "Break" ? "[&_h3]:font-normal [&_h3]:text-mute" : ""} ${on.has(`${day} ${it.time} ${it.title}`) ? "-mx-4 rounded-2xl bg-white/70 px-4" : ""}`}>
            <span className="pt-0.5 text-[15px] tabular-nums text-mute">{it.time}{it.end ? ` – ${it.end}` : ""}</span>
            <div>
              <h3 className="text-[21px] font-medium tracking-[-0.02em]">{it.title}{on.has(`${day} ${it.time} ${it.title}`) && <span className="ml-3 inline-flex translate-y-[-2px] items-center gap-1.5 rounded-full bg-[#dafbe1] px-2.5 py-0.5 align-middle text-[13px] font-normal text-[#1a7f37]"><span className="h-1.5 w-1.5 rounded-full bg-[#1a7f37]" aria-hidden />Now</span>}</h3>
              {it.notes && <p className="mt-1 text-[15px] text-mute">{it.notes.join(" · ")}</p>}
            </div>
            <span className="col-start-2 mt-2 text-sm text-mute sm:col-start-3 sm:mt-1 sm:text-right">{it.kind}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
