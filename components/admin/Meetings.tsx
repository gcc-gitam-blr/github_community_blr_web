"use client";
import { tabKeys } from "@/components/ui/tabKeys";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMinutesNote, createMeeting, createTask, finaliseMinutes, meetings as loadMeetings, owners as loadOwners, recordDecision, setAttendees, supersedeDecision, tasks as loadTasks, updateMeeting,
  type DecisionRow, type Meeting, type MeetingNote, type Task,
} from "@/lib/admin/client";
import { niceDate, todayIST } from "@/lib/admin/appointments";

/* Meetings and the decisions register. Minutes can be edited until they are finalised, then never again (a correction
   is a note beside them). A decision is never edited or deleted: an admin records a new one that supersedes it, and
   both stay. Action items are tasks that point at the meeting. The database enforces all of it. */
const card = "rounded-[12px] border border-line bg-white";
const btn = "inline-flex items-center justify-center rounded-md bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50";
const btnSoft = "inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-2 text-[14px] font-semibold transition hover:bg-soft disabled:opacity-50";
const input = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px]";
const KINDS: Meeting["kind"][] = ["core", "general", "planning", "review", "other"];
type Data = { list: Meeting[]; notes: MeetingNote[]; attendees: { meeting_id: number; user_id: string }[]; decisions: DecisionRow[]; names: Record<string, string> };
type Note = { k: "ok" | "err"; t: string } | null;
type Run = (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean>;

export function Meetings({ admin, meId }: { admin: boolean; meId: string }) {
  const [view, setView] = useState<"meetings" | "decisions">("meetings");
  const [data, setData] = useState<Data | null>(null); const [taskList, setTaskList] = useState<Task[]>([]); const [team, setTeam] = useState<{ id: string; handle: string; name: string }[]>([]);
  const [f, setF] = useState({ title: "", held: todayIST(), kind: "core" as Meeting["kind"], agenda: "" });
  const [note, setNote] = useState<Note>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setData(await loadMeetings()); setTaskList(await loadTasks()); setTeam(await loadOwners()); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const say = (ok: boolean, t: string) => setNote({ k: ok ? "ok" : "err", t });
  const run: Run = async (p, done) => { setBusy(true); setNote(null); const r = await p; setBusy(false); say(r.ok, r.ok ? done : (r as { error: string }).error); if (r.ok) await load(); return r.ok; };

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      <div role="tablist" onKeyDown={tabKeys} aria-label="Meetings or decisions" className="flex gap-1">
        {([["meetings", "Meetings"], ["decisions", "Decisions"]] as const).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} tabIndex={(view === v) ? 0 : -1} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-[14.5px] ${view === v ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{label}</button>
        ))}
      </div>

      {view === "meetings" ? (<>
        <section className={`${card} p-5`} aria-labelledby="mtg-h">
          <h2 id="mtg-h" className="text-[18px]">New meeting</h2>
          <form onSubmit={(e) => { e.preventDefault(); void run(createMeeting(f.title, f.held, f.kind, f.agenda), "Meeting created.").then((ok) => ok && setF({ ...f, title: "", agenda: "" })); }} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[14px] font-semibold sm:col-span-2">Title<input className={`${input} mt-1 font-normal`} value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">Date<input type="date" className={`${input} mt-1 font-normal`} value={f.held} onChange={(e) => setF({ ...f, held: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">Kind<select className={`${input} mt-1 font-normal`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Meeting["kind"] })}>{KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
            <label className="text-[14px] font-semibold sm:col-span-2">Agenda <span className="font-normal text-ink-3">(optional)</span><textarea rows={2} maxLength={3000} className={`${input} mt-1 font-normal`} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} /></label>
            <div className="sm:col-span-2"><button disabled={busy || f.title.trim().length < 3 || !f.held} className={btn}>Create meeting</button></div>
          </form>
        </section>
        <section className={card} aria-labelledby="mlist-h">
          <h2 id="mlist-h" className="border-b border-line px-5 py-3 text-[18px]">Meetings <span className="ml-1 rounded-full bg-soft px-2 py-0.5 text-[12px] font-normal text-ink-3">{data?.list.length ?? 0}</span></h2>
          {data === null ? <p className="p-5 text-ink-3">Loading…</p> : data.list.length === 0 ? <p className="p-5 text-ink-3">No meetings yet.</p> : (
            <ul className="divide-y divide-line">
              {data.list.map((m) => <MeetingRow key={m.id} m={m} data={data} tasks={taskList.filter((t) => t.meeting_id === m.id)} team={team} mine={m.created_by === meId} admin={admin} busy={busy} run={run} />)}
            </ul>
          )}
        </section>
      </>) : <Register data={data} admin={admin} busy={busy} run={run} />}
    </div>
  );
}

function MeetingRow({ m, data, tasks, team, mine, admin, busy, run }: { m: Meeting; data: Data; tasks: Task[]; team: { id: string; handle: string; name: string }[]; mine: boolean; admin: boolean; busy: boolean; run: Run }) {
  const final = !!m.minutes_finalised_at, canEdit = (mine || admin) && !final;
  const [title, setTitle] = useState(m.title); const [agenda, setAgenda] = useState(m.agenda ?? ""); const [minutes, setMinutes] = useState(m.minutes ?? "");
  const [who, setWho] = useState(data.attendees.filter((a) => a.meeting_id === m.id).map((a) => team.find((p) => p.id === a.user_id)?.handle ?? "").filter(Boolean).join(", "));
  const [fix, setFix] = useState(""); const [item, setItem] = useState({ title: "", owner: "", due: "" });
  const [d, setD] = useState({ title: "", decision: "", why: "" });
  const here = data.attendees.filter((a) => a.meeting_id === m.id).map((a) => data.names[a.user_id]).filter(Boolean);
  const notes = data.notes.filter((n) => n.meeting_id === m.id), decisions = data.decisions.filter((x) => x.meeting_id === m.id);
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-3 text-[14.5px] hover:bg-soft/60">
          <b>{m.title}</b><span className="text-ink-3">{niceDate(m.held_on)}</span>
          <span className="rounded-full border border-line px-2.5 py-0.5 text-[13px]">{final ? "Minutes final" : m.minutes ? "Minutes in draft" : "No minutes yet"}</span>
          {tasks.length > 0 && <span className="text-[13.5px] text-ink-3">{tasks.length} action {tasks.length === 1 ? "item" : "items"}</span>}
          <span className="ml-auto text-[13px] text-ink-3 group-open:hidden">Open</span>
        </summary>
        <div className="space-y-5 px-5 pb-5 text-[14.5px]">
          {canEdit ? (
            <form onSubmit={(e) => { e.preventDefault(); void run(updateMeeting(m.id, title, agenda, minutes), "Saved."); }} className="space-y-3">
              <label className="block text-[13.5px] font-semibold">Title<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
              <label className="block text-[13.5px] font-semibold">Agenda<textarea rows={2} maxLength={3000} value={agenda} onChange={(e) => setAgenda(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
              <label className="block text-[13.5px] font-semibold">Minutes <span className="font-normal text-ink-3">(no sensitive personal details; they become final when you finalise them)</span><textarea rows={6} maxLength={10000} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} className={btnSoft}>Save draft</button>
                <button type="button" disabled={busy || minutes.trim().length < 10} onClick={() => void run(updateMeeting(m.id, title, agenda, minutes), "Saved.").then((ok) => ok && run(finaliseMinutes(m.id), "The minutes are final."))} className={btn}>Save and finalise minutes</button>
              </div>
            </form>
          ) : (<>
            {m.agenda && <div><h4 className="text-[15px]">Agenda</h4><p className="mt-1 whitespace-pre-wrap text-ink-2">{m.agenda}</p></div>}
            <div><h4 className="text-[15px]">Minutes {final && <span className="font-normal text-ink-3">· final since {niceDate(m.minutes_finalised_at!.slice(0, 10))}</span>}</h4>
              <p className="mt-1 whitespace-pre-wrap text-ink-2">{m.minutes || "No minutes were written."}</p></div>
          </>)}

          {notes.length > 0 && <div><h4 className="text-[15px]">Notes added after the minutes were final</h4><ul className="mt-1 space-y-1 text-ink-2">{notes.map((n) => <li key={n.id}>{n.note} <span className="text-ink-3">· {n.author_id ? data.names[n.author_id] ?? "Someone" : "Someone"}, {niceDate(n.created_at.slice(0, 10))}</span></li>)}</ul></div>}
          {final && (
            <form onSubmit={(e) => { e.preventDefault(); void run(addMinutesNote(m.id, fix), "Note added.").then((ok) => ok && setFix("")); }} className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor={`fix-${m.id}`}>Add a correction or note</label>
              <input id={`fix-${m.id}`} value={fix} maxLength={2000} onChange={(e) => setFix(e.target.value)} placeholder="Add a correction or a note (it stays beside the minutes)" className={`${input} min-w-[220px] flex-1`} />
              <button disabled={busy || fix.trim().length < 3} className={btnSoft}>Add note</button>
            </form>
          )}

          <div>
            <h4 className="text-[15px]">Who was there</h4>
            {canEdit ? (
              <form onSubmit={(e) => { e.preventDefault(); void run(setAttendees(m.id, who.split(/[\s,]+/).filter(Boolean)), "Attendance saved."); }} className="mt-1 flex flex-wrap gap-2">
                <label className="sr-only" htmlFor={`who-${m.id}`}>GitHub usernames, separated by commas</label>
                <input id={`who-${m.id}`} value={who} onChange={(e) => setWho(e.target.value)} placeholder="github-usernames, separated by commas" className={`${input} min-w-[220px] flex-1`} />
                <button disabled={busy} className={btnSoft}>Save</button>
              </form>
            ) : <p className="mt-1 text-ink-2">{here.length ? here.join(", ") : "Not recorded."}</p>}
          </div>

          <div>
            <h4 className="text-[15px]">Action items</h4>
            {tasks.length > 0 && <ul className="mt-1 text-ink-2">{tasks.map((t) => <li key={t.id}>{t.title} <span className="text-ink-3">· {team.find((p) => p.id === t.owner_id)?.name ?? "owner without access"}, due {niceDate(t.due_on)}, {t.status}</span></li>)}</ul>}
            <form onSubmit={(e) => { e.preventDefault(); void run(createTask(item.title, "", item.owner, item.due, m.id), "Action item added.").then((ok) => ok && setItem({ ...item, title: "" })); }} className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-[13.5px] font-semibold">Task<input value={item.title} maxLength={140} onChange={(e) => setItem({ ...item, title: e.target.value })} className={`${input} mt-1 min-w-[200px] font-normal`} /></label>
              <label className="text-[13.5px] font-semibold">Owner<select value={item.owner} onChange={(e) => setItem({ ...item, owner: e.target.value })} className={`${input} mt-1 font-normal`}><option value="">Choose…</option>{team.map((p) => <option key={p.id} value={p.handle}>{p.name}</option>)}</select></label>
              <label className="text-[13.5px] font-semibold">Due<input type="date" min={todayIST()} value={item.due} onChange={(e) => setItem({ ...item, due: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
              <button disabled={busy || item.title.trim().length < 3 || !item.owner || !item.due} className={btnSoft}>Add</button>
            </form>
          </div>

          <div>
            <h4 className="text-[15px]">Decisions made here</h4>
            {decisions.length > 0 && <ul className="mt-1 space-y-1 text-ink-2">{decisions.map((x) => <li key={x.id}><b>{x.title}</b>: {x.decision}{x.status === "superseded" && <span className="text-ink-3"> (superseded)</span>}</li>)}</ul>}
            {(mine || admin) && (
              <form onSubmit={(e) => { e.preventDefault(); void run(recordDecision(m.id, d.title, d.decision, d.why, m.held_on > todayIST() ? todayIST() : m.held_on), "Decision recorded.").then((ok) => ok && setD({ title: "", decision: "", why: "" })); }} className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[13.5px] font-semibold">Title<input value={d.title} maxLength={140} onChange={(e) => setD({ ...d, title: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
                <label className="text-[13.5px] font-semibold">Why <span className="font-normal text-ink-3">(optional)</span><input value={d.why} maxLength={2000} onChange={(e) => setD({ ...d, why: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
                <label className="text-[13.5px] font-semibold sm:col-span-2">What was decided<textarea rows={2} maxLength={2000} value={d.decision} onChange={(e) => setD({ ...d, decision: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
                <div className="sm:col-span-2"><button disabled={busy || d.title.trim().length < 3 || d.decision.trim().length < 3} className={btnSoft}>Record decision</button><span className="ml-3 text-[13px] text-ink-3">It can&apos;t be edited afterwards; an admin can supersede it.</span></div>
              </form>
            )}
          </div>
        </div>
      </details>
    </li>
  );
}

function Register({ data, admin, busy, run }: { data: Data | null; admin: boolean; busy: boolean; run: Run }) {
  const [q, setQ] = useState(""); const [old, setOld] = useState(false); const [replacing, setReplacing] = useState<number | null>(null);
  const [n, setN] = useState({ title: "", decision: "", why: "" }); const [d, setD] = useState({ title: "", decision: "", why: "", on: todayIST() });
  const rows = useMemo(() => (data?.decisions ?? []).filter((x) => (old || x.status === "active") && `${x.title} ${x.decision}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q, old]);
  const meetingOf = (id: number | null) => data?.list.find((m) => m.id === id);
  return (
    <>
      {admin && (
        <section className={`${card} p-5`} aria-labelledby="dec-h">
          <h2 id="dec-h" className="text-[18px]">Record a decision</h2>
          <p className="mt-1 text-[14px] text-ink-2">For decisions that weren&apos;t made at a meeting listed here. Decisions made at a meeting are recorded on that meeting.</p>
          <form onSubmit={(e) => { e.preventDefault(); void run(recordDecision(null, d.title, d.decision, d.why, d.on), "Decision recorded.").then((ok) => ok && setD({ ...d, title: "", decision: "", why: "" })); }} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[14px] font-semibold">Title<input value={d.title} maxLength={140} onChange={(e) => setD({ ...d, title: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
            <label className="text-[14px] font-semibold">Date<input type="date" max={todayIST()} value={d.on} onChange={(e) => setD({ ...d, on: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
            <label className="text-[14px] font-semibold sm:col-span-2">What was decided<textarea rows={2} maxLength={2000} value={d.decision} onChange={(e) => setD({ ...d, decision: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
            <label className="text-[14px] font-semibold sm:col-span-2">Why <span className="font-normal text-ink-3">(optional)</span><input value={d.why} maxLength={2000} onChange={(e) => setD({ ...d, why: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
            <div className="sm:col-span-2"><button disabled={busy || d.title.trim().length < 3 || d.decision.trim().length < 3} className={btn}>Record decision</button></div>
          </form>
        </section>
      )}
      <section className={card} aria-labelledby="reg-h">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <h2 id="reg-h" className="text-[18px]">Decisions register</h2>
          <label className="sr-only" htmlFor="dec-find">Search decisions</label>
          <input id="dec-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${input} !w-auto min-w-[180px] flex-1`} />
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={old} onChange={(e) => setOld(e.target.checked)} /> Show superseded</label>
        </div>
        {data === null ? <p className="p-5 text-ink-3">Loading…</p> : rows.length === 0 ? <p className="p-5 text-ink-3">No decisions yet.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((x) => (
              <li key={x.id} className="px-5 py-3 text-[14.5px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <b className={x.status === "superseded" ? "text-ink-3" : ""}>{x.title}</b>
                  <span className="text-[13.5px] text-ink-3">{niceDate(x.decided_on)}{meetingOf(x.meeting_id) ? ` · ${meetingOf(x.meeting_id)!.title}` : ""}</span>
                  {x.status === "superseded" && <span className="rounded-full border border-line px-2.5 py-0.5 text-[13px] text-ink-3">Superseded</span>}
                  {admin && x.status === "active" && <button disabled={busy} onClick={() => { setReplacing(replacing === x.id ? null : x.id); setN({ title: x.title, decision: "", why: "" }); }} className="ml-auto text-ink-2 underline-offset-4 hover:underline" aria-expanded={replacing === x.id} aria-label={`Supersede ${x.title}`}>Supersede</button>}
                </div>
                <p className={`mt-1 whitespace-pre-wrap ${x.status === "superseded" ? "text-ink-3" : "text-ink-2"}`}>{x.decision}</p>
                {x.rationale && <p className="mt-1 text-[13.5px] text-ink-3">Why: {x.rationale}</p>}
                {x.supersedes_id && <p className="mt-1 text-[13.5px] text-ink-3">Replaces an earlier decision{(data.decisions.find((o) => o.id === x.supersedes_id)?.title) ? `: ${data.decisions.find((o) => o.id === x.supersedes_id)!.title}` : ""}.</p>}
                {replacing === x.id && (
                  <form onSubmit={(e) => { e.preventDefault(); void run(supersedeDecision(x.id, n.title, n.decision, n.why), "The old decision is superseded and the new one is on the record.").then((ok) => ok && setReplacing(null)); }} className="mt-3 grid gap-2 rounded-lg border border-line p-4 sm:grid-cols-2">
                    <label className="text-[13.5px] font-semibold">New title<input value={n.title} maxLength={140} onChange={(e) => setN({ ...n, title: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
                    <label className="text-[13.5px] font-semibold">Why it changed <span className="font-normal text-ink-3">(optional)</span><input value={n.why} maxLength={2000} onChange={(e) => setN({ ...n, why: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
                    <label className="text-[13.5px] font-semibold sm:col-span-2">The new decision<textarea rows={2} maxLength={2000} value={n.decision} onChange={(e) => setN({ ...n, decision: e.target.value })} className={`${input} mt-1 font-normal`} /></label>
                    <div className="sm:col-span-2"><button disabled={busy || n.title.trim().length < 3 || n.decision.trim().length < 3} className={btn}>Supersede</button><span className="ml-3 text-[13px] text-ink-3">The old decision stays on the record, marked superseded.</span></div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
