"use client";
import { useCallback, useEffect, useState } from "react";
import { BugIcon, CheckCircleIcon, SyncIcon } from "@primer/octicons-react";
import { clientErrors } from "@/lib/admin/client";
import { groupErrors, perDay, type ErrorRow } from "@/lib/client-errors";
import { RETENTION } from "@/lib/retention";
import { Sticker } from "@/components/ui/Sticker";

/* What broke in visitors' browsers in the last 30 days, the same error from many phones folded into one line.
   Reports come from components/ui/ErrorReporter.tsx; only admins can read them (supabase/schema.sql). */
const card = "rounded-[12px] border border-line bg-white";
const SHOWN = 6; // the rest stay behind "Show more": no long lists
const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const shade = (n: number, peak: number) => (n === 0 ? "bg-soft" : n / peak > 0.66 ? "bg-[#cf222e]" : n / peak > 0.33 ? "bg-[#fa4549]" : "bg-[#ffaba8]");

export function SiteErrors() {
  const [rows, setRows] = useState<ErrorRow[] | null | undefined>(undefined);
  const [all, setAll] = useState(false);
  const load = useCallback(async () => { setRows(undefined); setRows(await clientErrors()); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);

  if (rows === undefined) return <section className={`${card} h-48`} aria-busy="true" />;
  if (rows === null) return <p role="alert" className="rounded-md bg-[#ffebe9] px-4 py-3 text-[14.5px] text-[#a40e26]">Couldn&apos;t load error reports. If this is new, re-run <code>supabase/schema.sql</code> (it adds the table), then reload.</p>;

  const groups = groupErrors(rows), days = perDay(rows), peak = Math.max(1, ...days.map((d) => d.count));
  const busiest = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
  return (
    <div className="space-y-4">
      <section className={`${card} p-5`} aria-labelledby="err-h">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="err-h" className="text-[18px]">{rows.length ? <>{rows.length} report{rows.length === 1 ? "" : "s"} · {groups.length} different error{groups.length === 1 ? "" : "s"}</> : "No errors reported"}</h2>
            <p className="mt-1 text-[14.5px] text-ink-2">From visitors&apos; browsers, last {RETENTION.errorsDays} days. Only the message, the page and the browser: never what anyone typed.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[14px] font-semibold hover:border-ink/40"><SyncIcon size={14} />Refresh</button>
        </div>
        <figure className="mt-4">
          <div role="img" aria-label={rows.length ? `Reports per day over the last ${days.length} days. Busiest: ${busiest.day}, with ${busiest.count}.` : `No reports in the last ${days.length} days.`} className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[3px]">
            {days.map((d) => <span key={d.day} title={`${d.day}: ${d.count}`} className={`aspect-square rounded-[2px] ${shade(d.count, peak)}`} />)}
          </div>
          <figcaption className="mt-1.5 flex justify-between font-mono text-[11.5px] text-ink-3"><span>{days.length} days ago</span><span>today</span></figcaption>
        </figure>
      </section>

      {groups.length === 0 ? (
        <section className={`${card} flex items-center gap-5 p-6`}>
          <Sticker name="octocat" size={72} tilt={-6} alt="" className="flex-none" />
          <p className="text-[15px] text-ink-2"><CheckCircleIcon size={16} className="mr-1.5 inline text-[#1a7f37]" /><b className="text-ink">All green.</b> Nothing has broken on anyone&apos;s screen lately. When something does, it shows here within seconds.</p>
        </section>
      ) : (
        <section className={card} aria-label="Errors, most frequent first">
          <ul className="divide-y divide-line">
            {(all ? groups : groups.slice(0, SHOWN)).map((g) => (
              <li key={g.message} className="px-5 py-3.5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link">
                    <BugIcon size={16} className="mt-0.5 flex-none text-[#cf222e]" />
                    <span className="min-w-0 flex-1">
                      <code className="block break-words font-mono text-[13.5px] text-ink">{g.message}</code>
                      <span className="mt-1 block text-[13px] text-ink-3">last {ago(g.last)} · on {g.paths.slice(0, 3).join(", ")}{g.paths.length > 3 ? ` +${g.paths.length - 3}` : ""} · {g.browsers.slice(0, 3).join(", ")}</span>
                    </span>
                    <span className="flex-none rounded-full bg-[#ffebe9] px-2 py-0.5 font-mono text-[12px] font-semibold text-[#a40e26]" aria-label={`${g.count} reports`}>×{g.count}</span>
                  </summary>
                  {g.stack ? <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-ink p-3 font-mono text-[12px] leading-relaxed text-white/85">{g.stack}</pre>
                    : <p className="mt-3 text-[13px] text-ink-3">No stack trace came with this one.</p>}
                </details>
              </li>
            ))}
          </ul>
          {groups.length > SHOWN && <button onClick={() => setAll(!all)} className="w-full border-t border-line px-5 py-2.5 text-[14px] font-semibold text-link hover:bg-soft">{all ? "Show fewer" : `Show ${groups.length - SHOWN} more`}</button>}
        </section>
      )}
    </div>
  );
}
