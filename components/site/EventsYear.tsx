"use client";
import { useMemo, useState } from "react";
import { todayISO, useClientValue } from "@/lib/useClientValue";
import { CLUB, commitHash } from "@/lib/config";
import Link from "next/link";
import { EpochLink } from "@/components/epoch/EpochLink";
import { eventSlug } from "@/lib/events";
import { Sticker } from "@/components/ui/Sticker";

/* The academic year as a GitHub contribution graph. Event days are green,
   Epoch's month is gold. Pick a day (or a row) to see what's on. */
type Ev = (typeof CLUB.events)[number];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EPOCH_MONTH = CLUB.events.find((e) => e.href)?.date.slice(0, 7); // "2026-12"
const fmt = (e: Ev) => e.dateLabel ?? new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function EventsYear() {
  const events = useMemo(() => [...CLUB.events].sort((a, b) => a.date.localeCompare(b.date)), []);
  const byDay = useMemo(() => new Map(events.map((e) => [e.date, e])), [events]);

  // weeks of the academic year (Aug → Jul), Sunday-first like GitHub
  const { weeks, monthCols } = useMemo(() => {
    const start = new Date(2026, 7, 1); start.setDate(start.getDate() - start.getDay());
    const end = new Date(2027, 6, 31);
    const weeks: Date[][] = []; const monthCols: { col: number; label: string }[] = [];
    for (const d = new Date(start); d <= end; ) {
      const w: Date[] = [];
      for (let i = 0; i < 7; i++) { w.push(new Date(d)); d.setDate(d.getDate() + 1); }
      const first = w.find((x) => x.getDate() === 1);
      if (first) monthCols.push({ col: weeks.length, label: MONTHS[first.getMonth()] });
      weeks.push(w);
    }
    return { weeks, monthCols };
  }, []);

  const today = useClientValue(todayISO, "");
  const [picked, setSel] = useState<Ev | null>(null);
  // until someone picks a day, show what's next (or the last event once the year is over)
  const sel = picked ?? (today ? events.find((e) => e.date >= today) ?? events[events.length - 1] : events[0]);

  const eventFor = (day: string) => byDay.get(day) ?? (EPOCH_MONTH && day.startsWith(EPOCH_MONTH) ? events.find((e) => e.href) : undefined);
  const daysUntil = today ? Math.round((new Date(sel.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 864e5) : null;
  const inYear = (d: Date) => d >= new Date(2026, 7, 1) && d <= new Date(2027, 6, 31);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      {/* the graph */}
      <div className="min-w-0 rounded-[18px] border border-line bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[15px]"><b className="font-display text-[20px]">{events.length} events</b> <span className="text-ink-3">in the {CLUB.year} academic year</span></p>
          <p className="font-mono text-[12px] text-ink-3">{CLUB.university}</p>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="w-max [--c:13px] xl:[--c:16px]">
            <div className="relative mb-1.5 ml-7 h-4 font-mono text-[11px] text-ink-3">
              {monthCols.map((m) => <span key={m.col + m.label} className="absolute" style={{ left: `calc(${m.col} * (var(--c) + 3px))` }}>{m.label}</span>)}
            </div>
            <div className="flex gap-[3px]">
              <div className="mr-1 grid w-6 grid-rows-7 gap-[3px] font-mono text-[10px] leading-[var(--c)] text-ink-3"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
              {weeks.map((w, wi) => (
                <div key={wi} className="grid grid-rows-7 gap-[3px]">
                  {w.map((d) => {
                    const key = iso(d); const e = inYear(d) ? eventFor(key) : undefined;
                    const exact = byDay.has(key); const epoch = !!e?.href;
                    const isSel = e && e === sel && (exact || epoch);
                    const cls = !inYear(d) ? "bg-transparent" : exact && !epoch ? "bg-[#2ea043]" : epoch ? (exact ? "bg-[#e0a100]" : "bg-[#ffd966]") : "bg-[#ebeef0]";
                    return (
                      <button key={key} type="button" disabled={!e} onClick={() => e && setSel(e)}
                        title={e ? `${e.title} · ${fmt(e)}` : d.toDateString()} aria-label={e ? `${e.title}, ${fmt(e)}` : undefined} tabIndex={e ? 0 : -1}
                        className={`h-[var(--c)] w-[var(--c)] rounded-[3px] transition ${cls} ${e ? "cursor-pointer hover:scale-150" : "cursor-default"} ${isSel ? "ring-2 ring-ink ring-offset-1" : ""} ${key === today ? "outline outline-2 outline-link outline-offset-1" : ""}`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-[#ebeef0]" />no event</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-[#2ea043]" />event day</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] bg-[#ffd966]" />Epoch month</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[3px] outline outline-2 outline-link" />today</span>
        </div>
      </div>

      {/* selected event + the rest as compact rows */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <article className={`relative overflow-hidden rounded-[18px] border-2 border-ink p-6 sm:p-8 ${sel.href ? "bg-[#fff6d6]" : "bg-white"}`} aria-live="polite">
          <Sticker name={sel.href ? "adventure" : "agenda"} size={96} tilt={8} className="absolute right-5 top-5 hidden sm:block" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[13px] text-ink-3">
            <span className="rounded border border-line bg-soft px-2 py-0.5 text-ink-2">{commitHash(sel.title + sel.date)}</span>
            <span className="rounded-full bg-brand px-2.5 py-0.5 font-bold text-ink">{sel.type}</span>
            {daysUntil !== null && <span>{daysUntil > 0 ? `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}` : daysUntil === 0 ? "today" : "done ✓"}</span>}
          </div>
          <p className="mt-5 font-display text-[15px] font-bold text-ink-2">{fmt(sel)}</p>
          <h3 className="mt-1 max-w-[20ch] text-[clamp(28px,3.4vw,40px)] leading-[1.05]">{sel.title}</h3>
          <p className="mt-3 max-w-[52ch] text-[17px] text-ink-2">{sel.text}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <p className="font-mono text-[13px]">📍 {sel.where}</p>
            <Link href={`/events/${eventSlug(sel)}`} className="rounded-full border-2 border-ink px-4 py-2 font-mono text-[13px] font-bold transition hover:bg-ink hover:text-white">Event page →</Link>
            {sel.href && <EpochLink href={sel.href} className="rounded-full bg-ink px-5 py-2.5 font-mono text-[13px] font-bold text-[#ffc933] transition hover:-translate-y-0.5">Enter Epoch →</EpochLink>}
          </div>
        </article>

        <ol className="rounded-[18px] border border-line bg-white p-2">
          {events.map((e) => {
            const past = today && e.date < today && !e.href; const on = e === sel;
            return (
              <li key={e.date}>
                <button type="button" onClick={() => setSel(e)} className={`grid w-full grid-cols-[92px_1fr] items-baseline gap-3 rounded-xl px-3 py-3 text-left transition ${on ? "bg-soft" : "hover:bg-soft/60"} ${past ? "opacity-50" : ""}`}>
                  <span className="font-mono text-[12.5px] text-ink-3">{e.dateLabel ? e.dateLabel.replace(" 2026", "") : new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span className={`text-[15.5px] leading-snug ${on ? "font-semibold" : ""}`}>{e.title}{e.href && <span className="ml-2 rounded-full bg-[#ffd966] px-2 py-0.5 font-mono text-[11px] font-bold">flagship</span>}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
