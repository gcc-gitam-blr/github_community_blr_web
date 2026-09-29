"use client";
import { useState } from "react";
import { SCHEDULE } from "@/lib/epoch/config";

/* The two-day plan as a plain agenda: time, title, one muted line. */
export function PlanList() {
  const [day, setDay] = useState<1 | 2>(1);
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
          <li key={i} className={`grid grid-cols-[84px_1fr] gap-x-5 border-b border-hair py-5 sm:grid-cols-[130px_1fr_100px] ${it.kind === "Break" ? "[&_h3]:font-normal [&_h3]:text-mute" : ""}`}>
            <span className="pt-0.5 text-[15px] tabular-nums text-mute">{it.time}{it.end ? ` – ${it.end}` : ""}</span>
            <div>
              <h3 className="text-[21px] font-medium tracking-[-0.02em]">{it.title}</h3>
              {it.notes && <p className="mt-1 text-[15px] text-mute">{it.notes.join(" · ")}</p>}
            </div>
            <span className="col-start-2 mt-2 text-sm text-mute sm:col-start-3 sm:mt-1 sm:text-right">{it.kind}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
