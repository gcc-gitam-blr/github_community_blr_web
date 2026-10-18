"use client";
import { tabKeys } from "@/components/ui/tabKeys";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelProposal, completeProposal, createProposal, decideProposal, linkProposalEvent, proposals as loadProposals, setChecklistItem, setProposalDetails, submitProposal, updateProposal,
  type ChecklistItem, type Proposal, type ProposalDetails, type ProposalFields, type ProposalStatus,
} from "@/lib/admin/client";
import { niceDate, todayIST } from "@/lib/admin/appointments";
import { CheckIcon, DotFillIcon } from "@primer/octicons-react";
import { Composer, State, btn, btnSoft, card, head, input, type Tone } from "./kit";

/* Event proposals. A core member proposes an event and works through the checklist; an admin who is not the proposer
   approves, returns or rejects it. The database enforces every rule (supabase/schema.sql); this page only shows what
   will work. One group at a time, so the list stays short. */
const KINDS: Proposal["kind"][] = ["workshop", "talk", "hackathon", "meetup", "fest", "other"];
const STATUS: Record<ProposalStatus, string> = { draft: "Draft", submitted: "Waiting for a decision", returned: "Returned", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", completed: "Completed" };
const TONE: Record<ProposalStatus, Tone> = { draft: "draft", submitted: "waiting", returned: "changes", approved: "ok", rejected: "no", cancelled: "muted", completed: "done" };
const blank: ProposalFields = { title: "", kind: "workshop", date: "", venue: "", objective: "", expected: null, budget: null };
type Group = "decide" | "mine" | "coming" | "past";
type Note = { k: "ok" | "err"; t: string } | null;
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function Proposals({ admin, meId }: { admin: boolean; meId: string }) {
  const [data, setData] = useState<{ list: Proposal[]; items: ChecklistItem[]; names: Record<string, string> } | null>(null);
  const [picked, setPicked] = useState<Group | null>(null);
  const [form, setForm] = useState<ProposalFields>(blank); const [editing, setEditing] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setData(await loadProposals()), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const say = (ok: boolean, t: string) => setNote({ k: ok ? "ok" : "err", t });
  const today = todayIST();

  const inGroup = useCallback((p: Proposal, g: Group) => g === "decide" ? p.status === "submitted"
    : g === "mine" ? p.proposed_by === meId && !["completed", "rejected", "cancelled"].includes(p.status)
    : g === "coming" ? p.status === "approved" : ["completed", "rejected", "cancelled"].includes(p.status), [meId]);
  const counts = useMemo(() => Object.fromEntries((["decide", "mine", "coming", "past"] as Group[]).map((g) => [g, (data?.list ?? []).filter((p) => inGroup(p, g)).length])) as Record<Group, number>, [data, inGroup]);
  // until someone picks a group, show what needs attention first: a decision for admins, otherwise the person's own proposals
  const group: Group = picked ?? (admin && counts.decide ? "decide" : counts.mine ? "mine" : counts.coming ? "coming" : "mine");
  const shown = (data?.list ?? []).filter((p) => inGroup(p, group));

  const save = async () => {
    setBusy(true); setNote(null);
    const r = editing ? await updateProposal(editing, form) : await createProposal(form); setBusy(false);
    say(r.ok, r.ok ? (editing ? "Saved." : "Saved as a draft. Open it to fill in the document and tick the checklist, then submit it.") : r.error);
    if (r.ok) { setForm(blank); setEditing(null); setPicked("mine"); await load(); }
  };
  const run = async (p: Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true); setNote(null); const r = await p; setBusy(false);
    say(r.ok, r.ok ? done : (r as { error: string }).error); if (r.ok) await load();
    return r.ok;
  };
  const edit = (p: Proposal) => { setEditing(p.id); setForm({ title: p.title, kind: p.kind, date: p.proposed_date, venue: p.venue, objective: p.objective, expected: p.expected_attendance, budget: p.budget_inr }); requestAnimationFrame(() => document.getElementById("prop-title")?.focus()); };

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      <p className="text-[14.5px] text-ink-2">Every event starts here: propose it, tick the checklist, and an admin who is not you approves it. <b className="text-ink">This records the approval, but it can&apos;t stop a page from being published</b> in the content editor, so publish an event only after you see it approved here.</p>

      <Composer id="prop-h" title={editing ? "Edit proposal" : "Propose an event"} forceOpen={editing !== null}>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3 sm:grid-cols-2">
          <label className="text-[14px] font-semibold sm:col-span-2">Title<input id="prop-title" className={`${input} mt-1 font-normal`} value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="text-[14px] font-semibold">Kind<select className={`${input} mt-1 font-normal`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Proposal["kind"] })}>{KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
          <label className="text-[14px] font-semibold">Date<input type="date" min={today} className={`${input} mt-1 font-normal`} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className="text-[14px] font-semibold">Venue<input className={`${input} mt-1 font-normal`} value={form.venue} maxLength={120} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></label>
          <label className="text-[14px] font-semibold">Expected attendance <span className="font-normal text-ink-3">(optional)</span><input type="number" min={1} max={5000} className={`${input} mt-1 font-normal`} value={form.expected ?? ""} onChange={(e) => setForm({ ...form, expected: num(e.target.value) })} /></label>
          <label className="text-[14px] font-semibold sm:col-span-2">Goal: what should people leave with?<textarea rows={3} maxLength={1500} className={`${input} mt-1 font-normal`} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></label>
          <label className="text-[14px] font-semibold">Budget in ₹ <span className="font-normal text-ink-3">(optional)</span><input type="number" min={0} className={`${input} mt-1 font-normal`} value={form.budget ?? ""} onChange={(e) => setForm({ ...form, budget: num(e.target.value) })} /></label>
          <div className="flex items-end gap-2">
            <button disabled={busy || !form.title.trim() || !form.date || !form.venue.trim() || form.objective.trim().length < 10} className={btn}>{editing ? "Save changes" : "Save as draft"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank); }} className={btnSoft}>Cancel</button>}
          </div>
        </form>
      </Composer>

      <section className={card} aria-labelledby="list-h">
        <div className={head}>
          <h2 id="list-h" className="mr-1 text-[18px]">Proposals</h2>
          <div role="tablist" onKeyDown={tabKeys} aria-label="Which proposals" className="flex flex-wrap gap-1">
            {([["decide", "Waiting for a decision"], ["mine", "Mine"], ["coming", "Approved"], ["past", "Closed"]] as [Group, string][]).filter(([g]) => admin || g !== "decide").map(([g, label]) => (
              <button key={g} role="tab" aria-selected={group === g} tabIndex={(group === g) ? 0 : -1} onClick={() => setPicked(g)} className={`rounded-md px-3 py-1.5 text-[14px] ${group === g ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{label} <span className={group === g ? "text-white/70" : "text-ink-3"}>{counts[g]}</span></button>
            ))}
          </div>
        </div>
        {data === null ? <p className="p-5 text-ink-3">Loading…</p> : shown.length === 0 ? <p className="p-5 text-ink-3">{group === "decide" ? "Nothing is waiting for a decision." : group === "mine" ? "You have no open proposals. Propose an event above." : "Nothing here."}</p> : (
          <ul className="divide-y divide-line">
            {shown.map((p) => <Row key={p.id} p={p} items={data.items.filter((i) => i.proposal_id === p.id)} by={data.names[p.proposed_by ?? ""] ?? "Someone"} admin={admin} mine={p.proposed_by === meId} busy={busy} run={run} edit={edit} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ p, items, by, admin, mine, busy, run, edit }: { p: Proposal; items: ChecklistItem[]; by: string; admin: boolean; mine: boolean; busy: boolean; run: (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean>; edit: (p: Proposal) => void }) {
  const [why, setWhy] = useState(""); const [outcome, setOutcome] = useState(""); const [att, setAtt] = useState(p.proposed_date); const [noAtt, setNoAtt] = useState(false); const [attNote, setAttNote] = useState("");
  const [slug, setSlug] = useState(p.event_slug ?? "");
  const open = items.filter((i) => i.required && i.state === "open").length;
  const canTick = (mine || admin) && ["draft", "submitted", "returned", "approved"].includes(p.status);
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-3 text-[14.5px] hover:bg-soft/60">
          <b>{p.title}</b><span className="text-ink-3">{niceDate(p.proposed_date)}</span>
          <State tone={TONE[p.status]}>{STATUS[p.status]}</State>
          {items.length > 0 && ["draft", "returned", "submitted", "approved"].includes(p.status) && (
            // the checklist, read like a pull request's checks: green once every required item is done
            <span className={`inline-flex items-center gap-1 font-mono text-[12.5px] ${open ? "text-[#7d4e00]" : "text-[#116329]"}`}>
              {open ? <DotFillIcon size={12} aria-hidden /> : <CheckIcon size={12} aria-hidden />}{items.filter((i) => i.state !== "open").length}/{items.length} checks{open ? ` · ${open} required left` : ""}
            </span>
          )}
          <span className="ml-auto text-[13px] text-ink-3 group-open:hidden">Open</span>
        </summary>
        <div className="space-y-4 px-5 pb-5 text-[14.5px]">
          <p className="text-ink-3">{p.kind[0].toUpperCase() + p.kind.slice(1)} at {p.venue} · proposed by {by}{p.expected_attendance ? ` · about ${p.expected_attendance} people` : ""}{p.budget_inr !== null ? ` · budget ₹${p.budget_inr.toLocaleString("en-IN")}` : ""}</p>
          <p className="whitespace-pre-wrap text-ink-2">{p.objective}</p>
          {p.decision_note && <p className="rounded-md bg-soft px-3 py-2 text-ink-2"><b>{p.status === "returned" ? "Returned: " : p.status === "rejected" ? "Rejected: " : "Note: "}</b>{p.decision_note}</p>}

          <div>
            <h4 className="text-[15px]">Checklist</h4>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {items.map((i) => <Item key={i.id} i={i} canTick={canTick} busy={busy} run={run} />)}
            </ul>
          </div>

          <ProposalDoc p={p} editable={(mine || admin) && ["draft", "submitted", "returned", "approved"].includes(p.status)} busy={busy} run={run} />

          <div className="flex flex-wrap items-center gap-2">
            {mine && ["draft", "returned"].includes(p.status) && <button disabled={busy} onClick={() => edit(p)} className={btnSoft}>Edit</button>}
            {mine && ["draft", "returned"].includes(p.status) && <button disabled={busy} onClick={() => void run(submitProposal(p.id), "Submitted. An admin who is not you will decide.")} className={btn}>Submit for approval</button>}
            {(mine || admin) && ["draft", "submitted", "returned", "approved"].includes(p.status) && <button disabled={busy} onClick={() => void run(cancelProposal(p.id, why), "Cancelled.")} className={btnSoft}>Cancel this event</button>}
          </div>

          {admin && p.status === "submitted" && (
            <div className="rounded-lg border border-line p-4">
              <h4 className="text-[15px]">Decision</h4>
              {mine ? <p className="mt-1 text-ink-3">This is your own proposal, so another admin has to decide it.</p> : (<>
                <label className="mt-2 block text-[13.5px] font-semibold">Note <span className="font-normal text-ink-3">(required to return or reject)</span><input value={why} maxLength={1000} onChange={(e) => setWhy(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={busy || open > 0} onClick={() => void run(decideProposal(p.id, "approved", why), "Approved.")} className={btn}>Approve</button>
                  <button disabled={busy} onClick={() => void run(decideProposal(p.id, "returned", why), "Returned to the proposer.")} className={btnSoft}>Return for changes</button>
                  <button disabled={busy} onClick={() => void run(decideProposal(p.id, "rejected", why), "Rejected.")} className={btnSoft}>Reject</button>
                </div>
                {open > 0 && <p className="mt-2 text-[13.5px] text-[#9a6700]">{open} required checklist {open === 1 ? "item is" : "items are"} still open, so it can&apos;t be approved yet.</p>}
              </>)}
            </div>
          )}

          {p.status === "approved" && (mine || admin) && (
            <div className="grid gap-4 md:grid-cols-2">
              <form onSubmit={(e) => { e.preventDefault(); void run(linkProposalEvent(p.id, slug), "Linked."); }} className="rounded-lg border border-line p-4">
                <h4 className="text-[15px]">Public page</h4>
                <p className="mt-1 text-[13.5px] text-ink-3">Once the event page exists, add this proposal&apos;s number (<b>{p.id}</b>) to the event in the content editor, and note its address here.</p>
                <label className="mt-2 block text-[13.5px] font-semibold">Page address<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="git-merge-26" className={`${input} mt-1 font-normal`} /></label>
                <button disabled={busy} className={`${btnSoft} mt-2`}>Save</button>
              </form>
              <form onSubmit={(e) => { e.preventDefault(); void run(completeProposal(p.id, outcome, noAtt ? null : att, noAtt ? attNote : ""), "Marked as completed."); }} className="rounded-lg border border-line p-4">
                <h4 className="text-[15px]">After the event</h4>
                <label className="mt-2 block text-[13.5px] font-semibold">What happened?<textarea rows={3} maxLength={2000} value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
                {noAtt ? <label className="mt-2 block text-[13.5px] font-semibold">Why was attendance not recorded?<input value={attNote} maxLength={500} onChange={(e) => setAttNote(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
                  : <label className="mt-2 block text-[13.5px] font-semibold">Attendance recorded for the event on<input type="date" value={att} onChange={(e) => setAtt(e.target.value)} className={`${input} mt-1 font-normal`} /></label>}
                <label className="mt-2 flex items-center gap-2 text-[13.5px]"><input type="checkbox" checked={noAtt} onChange={(e) => setNoAtt(e.target.checked)} /> No attendance was recorded</label>
                <button disabled={busy || outcome.trim().length < 20} className={`${btn} mt-3`}>Mark completed</button>
              </form>
            </div>
          )}
          {p.status === "completed" && <div className="rounded-md bg-soft px-3 py-2 text-ink-2"><b>Outcome: </b>{p.outcome_note}{p.attendance_event ? <> <span className="text-ink-3">(attendance recorded for {niceDate(p.attendance_event)})</span></> : p.attendance_note ? <> <span className="text-ink-3">(no attendance: {p.attendance_note})</span></> : null}</div>}
          {p.event_slug && <p className="text-ink-3">Public page: <a href={`/events/${p.event_slug}`} className="underline underline-offset-2">/events/{p.event_slug}</a></p>}
        </div>
      </details>
    </li>
  );
}

/** The proposal in the university's format: what it still needs, its details, and the PDF to send. */
const DOC_PARTS: [keyof ProposalDetails, string][] = [["audience", "target audience"], ["description", "description"], ["outcomes", "learning outcomes"], ["requirements", "requirements"]];
function ProposalDoc({ p, editable, busy, run }: { p: Proposal; editable: boolean; busy: boolean; run: (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean> }) {
  const saved = p.details ?? {};
  const missing = DOC_PARTS.filter(([k]) => !saved[k]).map(([, l]) => l);
  // the fields are open from the start while something is missing, so "still to add" points at boxes right below it
  const [d, setD] = useState<ProposalDetails>(saved); const [editing, setEditing] = useState(editable && missing.length > 0);
  const set = (k: keyof ProposalDetails, v: string | number | boolean | undefined) => setD({ ...d, [k]: v });
  const text = (k: keyof ProposalDetails, label: string, hint: string, rows = 0, max = 300) => (
    <label className="block text-[13.5px] font-semibold sm:col-span-3">{label} <span className="font-normal text-ink-3">{hint}</span>
      {rows ? <textarea rows={rows} maxLength={max} value={String(d[k] ?? "")} onChange={(e) => set(k, e.target.value)} className={`${input} mt-1 font-normal`} />
        : <input maxLength={max} value={String(d[k] ?? "")} onChange={(e) => set(k, e.target.value)} className={`${input} mt-1 font-normal`} />}
    </label>
  );
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4 className="text-[15px]">Proposal document</h4>
        <span className={`text-[13.5px] ${missing.length ? "text-[#7d4e00]" : "text-[#116329]"}`}>{missing.length ? `Still to add: ${missing.join(", ")}.${editable ? (editing ? " Fill them in below." : "") : " Only the proposer or an admin can add them, while the proposal is open."}` : "Everything the university's format asks for is filled in."}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          {editable && !editing && <button disabled={busy} onClick={() => { setD(saved); setEditing(true); }} className={btnSoft}>Edit details</button>}
          <a href={`/admin/doc?proposal=${p.id}`} target="_blank" rel="noopener" className={btnSoft}>Download PDF <span aria-hidden>↗</span></a>
        </span>
      </div>
      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); void run(setProposalDetails(p.id, d), "Saved the document's details.").then((ok) => ok && setEditing(false)); }} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-[13.5px] font-semibold">Number of days<input type="number" min={1} max={30} value={d.days ?? 1} onChange={(e) => set("days", e.target.value ? Number(e.target.value) : undefined)} className={`${input} mt-1 font-normal`} /></label>
          <label className="block text-[13.5px] font-semibold">Time<input maxLength={60} value={d.time ?? ""} onChange={(e) => set("time", e.target.value)} placeholder="10 AM to 1 PM" className={`${input} mt-1 font-normal`} /></label>
          <label className="block text-[13.5px] font-semibold">Mode<select value={d.mode ?? "offline"} onChange={(e) => set("mode", e.target.value)} className={`${input} mt-1 font-normal`}><option value="offline">Offline</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label>
          <label className="flex items-center gap-2 text-[13.5px] sm:col-span-3"><input type="checkbox" checked={!!d.date_tbd} onChange={(e) => set("date_tbd", e.target.checked)} /> The date isn&apos;t fixed yet: the document says &ldquo;Yet to be decided&rdquo;</label>
          {text("audience", "Target audience", "(who it's for)", 0, 300)}
          {text("description", "Event description", "(lines starting with - become bullets)", 4, 3000)}
          {text("outcomes", "Learning outcomes", "(one per line; \"Basics: what they learn\" makes the first part bold)", 4, 2000)}
          {text("requirements", "Requirements", "(one per line: projector, posters, refreshments…)", 3, 1500)}
          <div className="flex gap-2 sm:col-span-3">
            <button disabled={busy} className={btn}>Save details</button>
            <button type="button" onClick={() => setEditing(false)} className={btnSoft}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Item({ i, canTick, busy, run }: { i: ChecklistItem; canTick: boolean; busy: boolean; run: (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean> }) {
  const [reason, setReason] = useState(i.note ?? ""); const [asking, setAsking] = useState(false);
  return (
    <li className="px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[13px] ${i.state === "done" ? "border-[#116329] bg-[#dafbe1] text-[#116329]" : i.state === "na" ? "border-line bg-soft text-ink-3" : "border-line"}`}>{i.state === "done" ? "✓" : i.state === "na" ? "–" : ""}</span>
        <span className="min-w-0 flex-1 basis-[220px]">{i.label}{!i.required && <span className="ml-1 text-[12.5px] text-ink-3">(optional)</span>}<span className="sr-only">, {i.state === "done" ? "done" : i.state === "na" ? "not needed" : "open"}</span></span>
        {canTick && (
          <span className="flex items-center gap-3 text-[13.5px]">
            {i.state !== "done" && <button disabled={busy} onClick={() => void run(setChecklistItem(i.id, "done", ""), "Ticked.")} className="font-semibold underline-offset-4 hover:underline">Done</button>}
            {i.state !== "na" && <button disabled={busy} onClick={() => setAsking(true)} className="text-ink-2 underline-offset-4 hover:underline">Not needed</button>}
            {i.state !== "open" && <button disabled={busy} onClick={() => void run(setChecklistItem(i.id, "open", ""), "Reopened.")} className="text-ink-3 underline-offset-4 hover:underline">Reopen</button>}
          </span>
        )}
      </div>
      {i.state === "na" && i.note && !asking && <p className="mt-1 pl-8 text-[13.5px] text-ink-3">Not needed: {i.note}</p>}
      {asking && (
        <form onSubmit={(e) => { e.preventDefault(); void run(setChecklistItem(i.id, "na", reason), "Marked as not needed.").then(() => setAsking(false)); }} className="mt-2 flex flex-wrap gap-2 pl-8">
          <label className="sr-only" htmlFor={`why-${i.id}`}>Why isn&apos;t this needed?</label>
          <input id={`why-${i.id}`} autoFocus value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Why isn't it needed?" className={`${input} min-w-[200px] flex-1`} />
          <button disabled={busy || reason.trim().length < 3} className={btnSoft}>Save</button>
          <button type="button" onClick={() => setAsking(false)} className="px-2 text-ink-3 underline-offset-4 hover:underline">Cancel</button>
        </form>
      )}
    </li>
  );
}
