"use client";
import { tabKeys } from "@/components/ui/tabKeys";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createTask, owners as loadOwners, reassignTask, setTaskStatus, tasks as loadTasks, type Task, type TaskStatus } from "@/lib/admin/client";
import { daysLeft, niceDate, todayIST } from "@/lib/admin/appointments";
import { Composer, State, btn, btnSoft, card, count, head, input, pillSelect, toneCls, type Tone } from "./kit";

/* Tasks: one owner and a due date from the moment a task exists. The owner, the creator or an admin moves it along;
   only the creator or an admin changes its owner or date. The database enforces this (supabase/schema.sql); the page
   shows one group at a time so the list stays short. */
const STATUS: Record<TaskStatus, string> = { todo: "To do", doing: "Doing", blocked: "Blocked", done: "Done", dropped: "Dropped" };
const TONE: Record<TaskStatus, Tone> = { todo: "draft", doing: "live", blocked: "blocked", done: "done", dropped: "muted" };
type Group = "mine" | "overdue" | "open" | "done";
type Note = { k: "ok" | "err"; t: string } | null;
const isOpen = (t: Task) => t.status === "todo" || t.status === "doing" || t.status === "blocked";

export function Tasks({ admin, meId }: { admin: boolean; meId: string }) {
  const [list, setList] = useState<Task[] | null>(null); const [team, setTeam] = useState<{ id: string; handle: string; name: string }[]>([]);
  const [picked, setPicked] = useState<Group | null>(null);
  const [f, setF] = useState({ title: "", details: "", owner: "", due: "" });
  const [note, setNote] = useState<Note>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setList(await loadTasks()); setTeam(await loadOwners()); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const today = todayIST();
  const who = (id: string) => team.find((p) => p.id === id);
  const inGroup = useCallback((t: Task, g: Group) => g === "mine" ? isOpen(t) && t.owner_id === meId : g === "overdue" ? isOpen(t) && t.due_on < today : g === "open" ? isOpen(t) : t.status === "done" || t.status === "dropped", [meId, today]);
  const counts = useMemo(() => Object.fromEntries((["mine", "overdue", "open", "done"] as Group[]).map((g) => [g, (list ?? []).filter((t) => inGroup(t, g)).length])) as Record<Group, number>, [list, inGroup]);
  const group: Group = picked ?? (counts.overdue && counts.mine ? "overdue" : counts.mine ? "mine" : "open");
  const shown = (list ?? []).filter((t) => inGroup(t, group)).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const orphans = (list ?? []).filter((t) => isOpen(t) && team.length > 0 && !who(t.owner_id)).length;
  const say = (ok: boolean, t: string) => setNote({ k: ok ? "ok" : "err", t });

  const run = async (p: Promise<{ ok: boolean; error?: string }>, done: string) => { setBusy(true); setNote(null); const r = await p; setBusy(false); say(r.ok, r.ok ? done : (r as { error: string }).error); if (r.ok) await load(); return r.ok; };
  const create = async () => { if (await run(createTask(f.title, f.details, f.owner, f.due), "Task created.")) { setF({ title: "", details: "", owner: f.owner, due: "" }); setPicked("open"); } };

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      {orphans > 0 && <p role="status" className="rounded-md bg-[#fff8c5] px-4 py-3 text-[14.5px] text-[#4d2d00]">{orphans} open {orphans === 1 ? "task belongs" : "tasks belong"} to someone who no longer has access. {admin ? "Open it and choose a new owner." : "Ask its creator or an admin to reassign it."}</p>}

      <Composer id="task-h" title="New task">
        <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="grid gap-3 sm:grid-cols-2">
          <label className="text-[14px] font-semibold sm:col-span-2">What needs doing?<input className={`${input} mt-1 font-normal`} value={f.title} maxLength={140} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="text-[14px] font-semibold">Owner<select className={`${input} mt-1 font-normal`} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}><option value="">Choose…</option>{team.map((p) => <option key={p.id} value={p.handle}>{p.name} (@{p.handle})</option>)}</select></label>
          <label className="text-[14px] font-semibold">Due<input type="date" min={today} className={`${input} mt-1 font-normal`} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
          <label className="text-[14px] font-semibold sm:col-span-2">Details <span className="font-normal text-ink-3">(optional)</span><textarea rows={2} maxLength={2000} className={`${input} mt-1 font-normal`} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
          <div className="sm:col-span-2"><button disabled={busy || f.title.trim().length < 3 || !f.owner || !f.due} className={btn}>Create task</button></div>
        </form>
      </Composer>

      <section className={card} aria-labelledby="tasks-h">
        <div className={head}>
          <h2 id="tasks-h" className="mr-1 text-[18px]">Tasks</h2>{list && <span className={count}>{list.length}</span>}
          <div role="tablist" onKeyDown={tabKeys} aria-label="Which tasks" className="flex flex-wrap gap-1">
            {([["mine", "Mine"], ["overdue", "Overdue"], ["open", "All open"], ["done", "Finished"]] as [Group, string][]).map(([g, label]) => (
              <button key={g} role="tab" aria-selected={group === g} tabIndex={(group === g) ? 0 : -1} onClick={() => setPicked(g)} className={`rounded-md px-3 py-1.5 text-[14px] ${group === g ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{label} <span className={group === g ? "text-white/70" : "text-ink-3"}>{counts[g]}</span></button>
            ))}
          </div>
        </div>
        {list === null ? <p className="p-5 text-ink-3">Loading…</p> : shown.length === 0 ? <p className="p-5 text-ink-3">{group === "mine" ? "Nothing is assigned to you." : group === "overdue" ? "Nothing is overdue." : "Nothing here."}</p> : (
          <ul className="divide-y divide-line">
            {shown.map((t) => <TaskRow key={t.id} t={t} owner={who(t.owner_id)} meId={meId} admin={admin} team={team} busy={busy} run={run} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function TaskRow({ t, owner, meId, admin, team, busy, run }: { t: Task; owner?: { handle: string; name: string }; meId: string; admin: boolean; team: { id: string; handle: string; name: string }[]; busy: boolean; run: (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean> }) {
  const [moving, setMoving] = useState(false); const [to, setTo] = useState(owner?.handle ?? ""); const [due, setDue] = useState(t.due_on);
  const canMove = t.owner_id === meId || t.creator_id === meId || admin, canReassign = t.creator_id === meId || admin;
  const left = daysLeft(t.due_on), late = isOpen(t) && left < 0;
  return (
    <li className="px-5 py-3 text-[14.5px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="min-w-0 flex-1 basis-[240px]"><b className={t.status === "done" || t.status === "dropped" ? "text-ink-3 line-through" : ""}>{t.title}</b>
          <span className="block text-[13.5px] text-ink-3">{owner ? `${owner.name} (@${owner.handle})` : <span className="font-semibold text-[#9a6700]">Owner no longer has access: reassign</span>}</span></span>
        <span className={`text-[13.5px] ${late ? "font-semibold text-[#a40e26]" : "text-ink-3"}`}>{isOpen(t) ? (late ? `${-left} ${-left === 1 ? "day" : "days"} late · ` : left === 0 ? "due today · " : "") : ""}{niceDate(t.due_on)}</span>
        {canMove ? (
          <select aria-label={`Status of ${t.title}`} value={t.status} disabled={busy} onChange={(e) => void run(setTaskStatus(t.id, e.target.value as TaskStatus), `Moved to ${STATUS[e.target.value as TaskStatus].toLowerCase()}.`)} className={`${pillSelect} ${toneCls(TONE[t.status])}`}>
            {(Object.keys(STATUS) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
          </select>
        ) : <State tone={TONE[t.status]}>{STATUS[t.status]}</State>}
        {canReassign && isOpen(t) && <button disabled={busy} onClick={() => setMoving(!moving)} className="text-ink-2 underline-offset-4 hover:underline" aria-expanded={moving} aria-label={`Reassign or change the date of ${t.title}`}>Reassign</button>}
      </div>
      {t.details && <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink-2">{t.details}</p>}
      {moving && (
        <form onSubmit={(e) => { e.preventDefault(); void run(reassignTask(t.id, to && to !== owner?.handle ? to : null, due !== t.due_on ? due : null), "Saved.").then((ok) => ok && setMoving(false)); }} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[13.5px] font-semibold">Owner<select value={to} onChange={(e) => setTo(e.target.value)} className={`${input} mt-1 font-normal`}><option value="">Choose…</option>{team.map((p) => <option key={p.id} value={p.handle}>{p.name} (@{p.handle})</option>)}</select></label>
          <label className="text-[13.5px] font-semibold">Due<input type="date" min={todayIST()} value={due < todayIST() ? todayIST() : due} onChange={(e) => setDue(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
          <button disabled={busy || !to} className={btnSoft}>Save</button>
        </form>
      )}
    </li>
  );
}
