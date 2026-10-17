"use client";
import { useEffect, useMemo, useState } from "react";
import { auditLog, type AuditRow } from "@/lib/admin/client";
import { describe, entityLabel } from "@/lib/admin/audit";

/* The club's activity log, newest first: who changed what, and when. Admins only (the database refuses everyone else).
   It holds ids and states, never the text people wrote, so there is nothing private to scroll past. */
const input = "rounded-md border border-line bg-white px-3 py-2 text-[14.5px]";
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function Activity() {
  const [data, setData] = useState<{ rows: AuditRow[]; names: Record<string, string> } | null>(null);
  const [entity, setEntity] = useState(""); const [q, setQ] = useState("");
  useEffect(() => { let live = true; void auditLog().then((d) => { if (live) setData(d); }); return () => { live = false; }; }, []);
  const entities = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.entity))].sort(), [data]);
  const shown = useMemo(() => (data?.rows ?? []).filter((r) => (!entity || r.entity === entity) && `${describe(r)} ${data?.names[r.actor ?? ""] ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 150), [data, entity, q]);
  return (
    <section className="rounded-[12px] border border-line bg-white" aria-labelledby="act-h">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <h2 id="act-h" className="text-[18px]">Activity</h2>
        <label className="sr-only" htmlFor="act-ent">Show</label>
        <select id="act-ent" value={entity} onChange={(e) => setEntity(e.target.value)} className={input}>
          <option value="">Everything</option>{entities.map((e) => <option key={e} value={e}>{entityLabel(e)}</option>)}
        </select>
        <label className="sr-only" htmlFor="act-q">Search the activity</label>
        <input id="act-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${input} min-w-[160px] flex-1`} />
      </div>
      {data === null ? <p className="p-5 text-ink-3">Loading…</p> : shown.length === 0 ? <p className="p-5 text-ink-3">{data.rows.length ? "Nothing matches." : "Nothing has been recorded yet."}</p> : (
        <ul className="divide-y divide-line">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-2.5 text-[14.5px]">
              <span className="w-[108px] shrink-0 font-mono text-[12.5px] text-ink-3">{when(r.at)}</span>
              <span className="min-w-0 flex-1 basis-[240px]">{describe(r)}</span>
              <span className="text-[13.5px] text-ink-3">{r.actor ? data.names[r.actor] ?? "Someone" : "The system"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">Showing the latest {shown.length} of {data?.rows.length ?? 0} loaded. The log keeps 36 months, and nobody can change or delete a line.</p>
    </section>
  );
}
