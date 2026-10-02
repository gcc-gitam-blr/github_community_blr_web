"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEpoch } from "@/components/epoch/EpochProvider";
import { CLUB } from "@/lib/config";
import { fromLine, fromLumaCsv, type Attendee, type Import } from "@/lib/attendance";
import { addAttendees, attendance, removeAttendee, sendCertificates, type AttendanceRow } from "@/lib/admin/client";
import type { JoinRequest } from "@/lib/epoch/types";

/* Who actually came to each event, and their certificates. Certificates go only to people listed here —
   never to everyone who signed up. */
const card = "rounded-[12px] border border-line bg-white";
const btn = "inline-flex items-center justify-center rounded-md bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50";
const soft = "inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-2.5 text-[14.5px] font-semibold transition hover:border-ink/40 disabled:opacity-50";
const today = () => new Date().toISOString().slice(0, 10);
const events = [...CLUB.events].filter((e) => !e.dateLabel).sort((a, b) => a.date.localeCompare(b.date));
// default: the most recent event that has happened, else the next one
const defaultEvent = () => [...events].reverse().find((e) => e.date <= today())?.date ?? events[0]?.date ?? "";

type Mode = "luma" | "signups" | "hand";

export function Attendance({ admin }: { admin: boolean }) {
  const { store } = useEpoch();
  const [event, setEvent] = useState(defaultEvent);
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [note, setNote] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("luma");
  const [preview, setPreview] = useState<Import | null>(null);
  const [joins, setJoins] = useState<JoinRequest[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [typed, setTyped] = useState("");

  const load = useCallback(async () => { setRows(null); setRows(await attendance(event)); }, [event]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (mode === "signups" && !joins) store?.joinRequests?.().then(setJoins); }, [mode, joins, store]);

  const here = useMemo(() => new Set((rows ?? []).map((r) => r.email)), [rows]);
  const unsent = (rows ?? []).filter((r) => !r.emailed_at).length;
  const title = events.find((e) => e.date === event)?.title ?? event;

  const add = async (people: Attendee[], what: string) => {
    setBusy(true); setNote(null);
    const r = await addAttendees(event, people); setBusy(false);
    if (!r.ok) return setNote({ k: "err", t: r.error });
    setNote({ k: "ok", t: `${what}: added ${r.added}${people.length - r.added ? ` (${people.length - r.added} were already on the list)` : ""}.` });
    setPreview(null); setPicked(new Set()); setTyped(""); await load();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const p = fromLumaCsv(await f.text()); setPreview(p);
    if (!p.attendees.length) setNote({ k: "err", t: "No guests found in that file. In Luma: open the event → Guests → ⋯ → Export as CSV, then choose that file." });
  };

  const typedPeople = typed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const typedOk = typedPeople.map(fromLine);

  const send = async (ids?: string[]) => {
    const n = ids?.length ?? unsent;
    if (!window.confirm(`Email ${n} certificate${n === 1 ? "" : "s"} for ${title}? This can't be undone.`)) return;
    setBusy(true); setNote(null);
    const r = await sendCertificates(event, ids); setBusy(false);
    setNote(r.ok ? { k: "ok", t: `Sent ${r.sent} of ${r.total}${r.failed ? ` — ${r.failed} failed, try again later` : ""}.` } : { k: "err", t: r.error });
    await load();
  };

  const csv = () => {
    const q = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const body = ["name,email,github,certificate", ...(rows ?? []).map((r) => [r.name, r.email, r.handle ?? "", `${location.origin}/certificates/${r.id}`].map(q).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" })); a.download = `attendance-${event}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const shown = (joins ?? []).filter((j) => !here.has(j.email.toLowerCase()) && (!filter || `${j.handle} ${j.email}`.toLowerCase().includes(filter.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-end gap-4 p-5`}>
        <label className="min-w-[260px] flex-1">
          <span className="mb-1.5 block text-[13px] text-ink-2">Event</span>
          <select value={event} onChange={(e) => { setEvent(e.target.value); setNote(null); setPreview(null); }} className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px]">
            {events.map((e) => <option key={e.date} value={e.date}>{new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — {e.title}{e.date > today() ? " (upcoming)" : ""}</option>)}
          </select>
        </label>
        <p className="pb-2.5 text-[14.5px] text-ink-2"><b className="text-ink">{rows?.length ?? "…"}</b> attended · <b className="text-ink">{rows ? rows.length - unsent : "…"}</b> {rows && rows.length - unsent === 1 ? "certificate" : "certificates"} sent</p>
      </div>

      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}

      <section className={card} aria-labelledby="add-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="add-h" className="text-[18px]">Add people who came</h2>
          <div role="tablist" aria-label="How to add" className="flex rounded-md border border-line p-0.5 text-[13.5px]">
            {([["luma", "Luma check-ins"], ["signups", "From sign-ups"], ["hand", "By hand"]] as [Mode, string][]).map(([m, l]) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded px-3 py-1.5 ${mode === m ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {mode === "luma" && (<>
            <p className="text-[14.5px] text-ink-2">In Luma, open the event → <b>Guests</b> → <b>⋯</b> → <b>Export as CSV</b>. Only guests Luma checked in at the door are added.</p>
            <input type="file" accept=".csv,text/csv" aria-label="Luma guest list (CSV)" onChange={(e) => onFile(e.target.files?.[0])} className="mt-4 block text-[14px] file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-4 file:py-2 file:font-semibold" />
            {preview && preview.attendees.length > 0 && (
              <div className="mt-4 rounded-md border border-line bg-soft p-4 text-[14.5px]">
                <p><b>{preview.attendees.length}</b> {preview.hasCheckIn ? "checked in" : "approved guests"}{preview.skipped.notCheckedIn ? ` · ${preview.skipped.notCheckedIn} didn't check in (left out)` : ""}{preview.skipped.noEmail ? ` · ${preview.skipped.noEmail} without an email` : ""}{preview.skipped.duplicate ? ` · ${preview.skipped.duplicate} duplicates` : ""}</p>
                {!preview.hasCheckIn && <p className="mt-1 text-[#9a6700]">This file has no check-in column, so everyone approved is included. Use Luma&apos;s check-in on the day to be exact.</p>}
                <p className="mt-1 text-ink-3">{preview.attendees.slice(0, 4).map((a) => a.name).join(", ")}{preview.attendees.length > 4 ? "…" : ""}</p>
                <button disabled={busy} onClick={() => add(preview.attendees, "Luma import")} className={`${btn} mt-3`}>Add {preview.attendees.length} people</button>
              </div>
            )}
          </>)}

          {mode === "signups" && (<>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search sign-ups by GitHub or email" aria-label="Search sign-ups" className="w-full rounded-md border border-line px-3 py-2.5 text-[15px]" />
            {joins === null ? <p className="mt-3 text-ink-3">Loading…</p> : shown.length === 0 ? <p className="mt-3 text-ink-3">{joins.length ? "Everyone matching is already on the list." : "No sign-ups yet."}</p> : (
              <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line" data-lenis-prevent>
                {shown.map((j) => (
                  <li key={j.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[14.5px] hover:bg-soft">
                    <input type="checkbox" checked={picked.has(j.id)} onChange={(e) => { const s = new Set(picked); if (e.target.checked) s.add(j.id); else s.delete(j.id); setPicked(s); }} />
                    <span className="font-semibold">@{j.handle}</span><span className="truncate text-ink-3">{j.email}</span>
                  </label></li>
                ))}
              </ul>
            )}
            <button disabled={busy || !picked.size} onClick={() => add((joins ?? []).filter((j) => picked.has(j.id)).map((j) => ({ name: j.handle, email: j.email, handle: j.handle })), "From sign-ups")} className={`${btn} mt-3`}>Add {picked.size || ""} selected</button>
            <p className="mt-2 text-[13px] text-ink-3">Sign-ups only have a GitHub username, so that&apos;s the name on their certificate. For full names, use Luma or add by hand.</p>
          </>)}

          {mode === "hand" && (<>
            <label className="block text-[14.5px] text-ink-2" htmlFor="typed">One person per line: <code>Full name, email, github (optional)</code></label>
            <textarea id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} rows={5} placeholder={"Ada Lovelace, ada@gitam.in, ada-l\nGrace Hopper, grace@gitam.in"} className="mt-2 w-full rounded-md border border-line px-3 py-2.5 font-mono text-[14px]" />
            {typedPeople.length > 0 && typedOk.some((p) => !p) && <p className="text-[13.5px] text-[#a40e26]">Check line {typedOk.findIndex((p) => !p) + 1}: it needs a name and a valid email.</p>}
            <button disabled={busy || !typedPeople.length || typedOk.some((p) => !p)} onClick={() => add(typedOk as Attendee[], "Added by hand")} className={`${btn} mt-2`}>Add {typedPeople.length || ""}</button>
          </>)}
        </div>
      </section>

      <section className={card} aria-labelledby="list-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="list-h" className="text-[18px]">Attended {title}</h2>
          <div className="flex flex-wrap gap-2">
            {rows && rows.length > 0 && <button onClick={csv} className={soft}>Download CSV</button>}
            {rows && rows.length > 0 && <a href={`/certificates/${rows[0].id}`} target="_blank" rel="noopener" className={soft}>Preview a certificate ↗</a>}
            {admin && <button disabled={busy || !unsent} onClick={() => send()} className={btn}>{unsent ? `Email ${unsent} certificate${unsent === 1 ? "" : "s"}` : "All certificates sent"}</button>}
          </div>
        </div>
        {rows === null ? <p className="p-5 text-ink-3">Loading…</p> : rows.length === 0 ? <p className="p-5 text-ink-3">Nobody yet. Add the people who came, above.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[14.5px]">
              <thead className="bg-soft text-[13px] text-ink-2"><tr><th className="px-5 py-2 font-normal">Name</th><th className="font-normal">Email</th><th className="font-normal">Certificate</th><th className="px-5 text-right font-normal"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-5 py-2.5"><span className="font-semibold">{r.name}</span>{r.handle && <span className="ml-2 text-ink-3">@{r.handle}</span>}</td>
                    <td className="text-ink-2">{r.email}</td>
                    <td>{r.emailed_at ? <span className="text-[#116329]">Sent {new Date(r.emailed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span> : <span className="text-ink-3">Not sent</span>}</td>
                    <td className="whitespace-nowrap px-5 text-right">
                      <a href={`/certificates/${r.id}`} target="_blank" rel="noopener" className="text-link hover:underline">View</a>
                      {admin && <button onClick={() => send([r.id])} disabled={busy} className="ml-4 text-link hover:underline">{r.emailed_at ? "Re-send" : "Send"}</button>}
                      <button onClick={async () => { if (window.confirm(`Remove ${r.name}? Their certificate link will stop working.`)) { const x = await removeAttendee(r.id); if (!x.ok) setNote({ k: "err", t: x.error }); await load(); } }} className="ml-4 text-[#a40e26] hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
