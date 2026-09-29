"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { mono } from "../Bits";
import { SCHEDULE, type SessionItem } from "@/lib/epoch/config";

const dot: Record<SessionItem["kind"], string> = { Ceremony: "#ffc933", Workshop: "#b9e0f7", Competition: "#b48be6", Booths: "#4fd1a1", Talk: "#ff9ec7", Break: "#5b5d78" };

/* The Plan of Action as a git-log: each session is a commit on the day's branch. */
export function PlanTimeline() {
  const [day, setDay] = useState<1 | 2>(1);
  const d = SCHEDULE.find((s) => s.day === day)!;
  return (
    <div>
      <div className="mb-10 inline-flex rounded-full border border-white/10 bg-night-2 p-1.5" role="tablist" aria-label="Day">
        {SCHEDULE.map((s) => (
          <button key={s.day} role="tab" aria-selected={day === s.day} onClick={() => setDay(s.day)} className={`rounded-full px-7 py-2.5 font-display text-lg font-bold transition ${day === s.day ? "bg-gold text-night" : "text-fog hover:text-white"}`}>{s.label}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.ol key={day} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="relative space-y-4 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-0.5 before:bg-white/10 sm:before:left-[123px]">
          {d.items.map((it, i) => (
            <li key={i} className="relative grid grid-cols-[32px_1fr] gap-4 sm:grid-cols-[92px_32px_1fr] sm:gap-4">
              <span className={`${mono} hidden pt-5 text-right text-fog sm:block`}>{it.time}{it.end ? <><br /><span className="opacity-60">{it.end}</span></> : null}</span>
              <span className="relative z-10 mt-5 h-[30px] w-[30px] rounded-full border-4 border-night" style={{ background: dot[it.kind] }} />
              <div className={`rounded-3xl border border-edge p-5 sm:p-6 ${it.kind === "Break" ? "bg-transparent opacity-60" : "bg-night-2/80"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-3"><span className={`${mono} text-fog sm:hidden`}>{it.time}{it.end ? `–${it.end}` : ""}</span><span className={`${mono} rounded-full px-2.5 py-1 font-bold text-night`} style={{ background: dot[it.kind] }}>{it.kind}</span></div>
                <h3 className="text-2xl">{it.title}</h3>
                {it.notes && <ul className="mt-3 flex flex-wrap gap-2">{it.notes.map((n) => <li key={n} className="rounded-full bg-white/5 px-3 py-1 text-sm text-fog">{n}</li>)}</ul>}
              </div>
            </li>
          ))}
        </motion.ol>
      </AnimatePresence>
    </div>
  );
}
