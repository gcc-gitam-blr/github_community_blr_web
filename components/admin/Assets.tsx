"use client";
import { tabKeys } from "@/components/ui/tabKeys";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assets as loadAssets, completeHandover, handovers as loadHandovers, saveAsset, setAssetNotes, setHandoverItem, startHandover,
  type Asset, type AssetFields, type Handover, type HandoverItem,
} from "@/lib/admin/client";
import { groupProblems, problemText, type AssetProblem } from "@/lib/assets";
import { niceDate } from "@/lib/admin/appointments";

/* Where the club's accounts live and who is answerable for each, and the new-team handover checklist (docs/ROLLOVER.md).
   NEVER put a password, token or key here: say where it is kept. The database refuses text that looks like one. */
const card = "rounded-[12px] border border-line bg-white";
const btn = "inline-flex items-center justify-center rounded-md bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50";
const btnSoft = "inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-2 text-[14px] font-semibold transition hover:bg-soft disabled:opacity-50";
const input = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px]";
const KIND: Record<Asset["kind"], string> = { domain: "Domain", hosting: "Hosting", repository: "Code", database: "Database", email: "Email", social: "Social", design: "Design", event_platform: "Events", other: "Other" };
const blank: AssetFields = { name: "", kind: "other", url: "", owner: "", backup: "", notes: "", reviewDue: "" };
type Note = { k: "ok" | "err"; t: string } | null;
type Run = (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean>;

export function Assets({ admin, meId }: { admin: boolean; meId: string }) {
  const [view, setView] = useState<"registry" | "handover">("registry");
  const [data, setData] = useState<{ list: Asset[]; problems: AssetProblem[]; people: Record<string, { handle: string; name: string }> } | null>(null);
  const [ho, setHo] = useState<{ lists: Handover[]; items: HandoverItem[] } | null>(null);
  const [note, setNote] = useState<Note>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setData(await loadAssets()); setHo(await loadHandovers()); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const run: Run = async (p, done) => { setBusy(true); setNote(null); const r = await p; setBusy(false); setNote({ k: r.ok ? "ok" : "err", t: r.ok ? done : (r as { error: string }).error }); if (r.ok) await load(); return r.ok; };
  const flagged = groupProblems(data?.problems ?? []).length;

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      <p className="rounded-md bg-[#fff8c5] px-4 py-3 text-[14.5px] text-[#4d2d00]"><b>Never put a password, token or key here.</b> Write where it is kept instead, for example &ldquo;in the club password manager&rdquo;. This page refuses text that looks like a secret.</p>
      <div role="tablist" onKeyDown={tabKeys} aria-label="Registry or handover" className="flex gap-1">
        <button role="tab" aria-selected={view === "registry"} tabIndex={(view === "registry") ? 0 : -1} onClick={() => setView("registry")} className={`rounded-md px-3 py-1.5 text-[14.5px] ${view === "registry" ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>Registry {flagged > 0 && <span className={view === "registry" ? "text-white/70" : "text-[#9a6700]"}>{flagged} to check</span>}</button>
        <button role="tab" aria-selected={view === "handover"} tabIndex={(view === "handover") ? 0 : -1} onClick={() => setView("handover")} className={`rounded-md px-3 py-1.5 text-[14.5px] ${view === "handover" ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>Handover checklist</button>
      </div>
      {view === "registry" ? <Registry data={data} admin={admin} meId={meId} busy={busy} run={run} /> : <HandoverView ho={ho} admin={admin} busy={busy} run={run} />}
    </div>
  );
}

function Registry({ data, admin, meId, busy, run }: { data: { list: Asset[]; problems: AssetProblem[]; people: Record<string, { handle: string; name: string }> } | null; admin: boolean; meId: string; busy: boolean; run: Run }) {
  const [f, setF] = useState<AssetFields>(blank); const [editing, setEditing] = useState<number | null>(null);
  const problems = useMemo(() => new Map(groupProblems(data?.problems ?? []).map((g) => [g.id, g.problems])), [data]);
  const who = (id: string | null) => (id && data?.people[id] ? `${data.people[id].name} (@${data.people[id].handle})` : null);
  const edit = (a: Asset) => { setEditing(a.id); setF({ name: a.name, kind: a.kind, url: a.location_url ?? "", owner: data?.people[a.owner_id ?? ""]?.handle ?? "", backup: data?.people[a.backup_owner_id ?? ""]?.handle ?? "", notes: a.notes ?? "", reviewDue: a.review_due_on ?? "" }); document.getElementById("asset-name")?.focus(); };
  return (
    <>
      {admin && (
        <section className={`${card} p-5`} aria-labelledby="asset-h">
          <h2 id="asset-h" className="text-[18px]">{editing ? "Edit asset" : "Add an asset"}</h2>
          <form onSubmit={(e) => { e.preventDefault(); void run(saveAsset(editing, f), "Saved.").then((ok) => { if (ok) { setF(blank); setEditing(null); } }); }} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[14px] font-semibold">Name<input id="asset-name" className={`${input} mt-1 font-normal`} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">Kind<select className={`${input} mt-1 font-normal`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Asset["kind"] })}>{(Object.keys(KIND) as Asset["kind"][]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}</select></label>
            <label className="text-[14px] font-semibold sm:col-span-2">Link <span className="font-normal text-ink-3">(https:// only; the page where it is managed)</span><input className={`${input} mt-1 font-normal`} value={f.url} maxLength={300} onChange={(e) => setF({ ...f, url: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">Owner <span className="font-normal text-ink-3">(GitHub username)</span><input className={`${input} mt-1 font-normal`} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} autoComplete="off" /></label>
            <label className="text-[14px] font-semibold">Backup owner <span className="font-normal text-ink-3">(a different person)</span><input className={`${input} mt-1 font-normal`} value={f.backup} onChange={(e) => setF({ ...f, backup: e.target.value })} autoComplete="off" /></label>
            <label className="text-[14px] font-semibold sm:col-span-2">Notes <span className="font-normal text-ink-3">(where the login is kept, when it renews; no secrets)</span><textarea rows={2} maxLength={1000} className={`${input} mt-1 font-normal`} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">Check again by <span className="font-normal text-ink-3">(optional)</span><input type="date" className={`${input} mt-1 font-normal`} value={f.reviewDue} onChange={(e) => setF({ ...f, reviewDue: e.target.value })} /></label>
            <div className="flex items-end gap-2">
              <button disabled={busy || f.name.trim().length < 2} className={btn}>{editing ? "Save changes" : "Add asset"}</button>
              {editing && <button type="button" onClick={() => { setEditing(null); setF(blank); }} className={btnSoft}>Cancel</button>}
            </div>
          </form>
        </section>
      )}
      <section className={card} aria-labelledby="reg-h">
        <h2 id="reg-h" className="border-b border-line px-5 py-3 text-[18px]">Registry <span className="ml-1 rounded-full bg-soft px-2 py-0.5 text-[12px] font-normal text-ink-3">{data?.list.length ?? 0}</span></h2>
        {data === null ? <p className="p-5 text-ink-3">Loading…</p> : data.list.length === 0 ? <p className="p-5 text-ink-3">Nothing listed yet.</p> : (
          <ul className="divide-y divide-line">
            {data.list.map((a) => <AssetRow key={a.id} a={a} owner={who(a.owner_id)} backup={who(a.backup_owner_id)} problems={problems.get(a.id) ?? []} canNotes={admin || a.owner_id === meId} admin={admin} busy={busy} run={run} edit={edit} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function AssetRow({ a, owner, backup, problems, canNotes, admin, busy, run, edit }: { a: Asset; owner: string | null; backup: string | null; problems: AssetProblem[]; canNotes: boolean; admin: boolean; busy: boolean; run: Run; edit: (a: Asset) => void }) {
  const [notes, setNotes] = useState(a.notes ?? ""); const [open, setOpen] = useState(false);
  return (
    <li className="px-5 py-3 text-[14.5px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="min-w-0 flex-1 basis-[220px]">
          <b>{a.name}</b> <span className="text-[13px] text-ink-3">{KIND[a.kind]}</span>
          <span className="block text-[13.5px] text-ink-3">Owner: {owner ?? "nobody yet"} · Backup: {backup ?? "nobody yet"}{a.review_due_on ? ` · check by ${niceDate(a.review_due_on)}` : ""}</span>
        </span>
        {a.location_url && <a href={a.location_url} target="_blank" rel="noopener noreferrer" className="text-[13.5px] underline underline-offset-2">Open</a>}
        {canNotes && <button disabled={busy} onClick={() => setOpen(!open)} aria-expanded={open} className="text-ink-2 underline-offset-4 hover:underline" aria-label={`Notes for ${a.name}`}>Notes</button>}
        {admin && <button disabled={busy} onClick={() => edit(a)} className="text-ink-2 underline-offset-4 hover:underline" aria-label={`Edit ${a.name}`}>Edit</button>}
      </div>
      {problems.length > 0 && <ul className="mt-1 text-[13.5px] font-semibold text-[#9a6700]">{problems.map((p) => <li key={p.problem}>This asset {problemText(p)}.</li>)}</ul>}
      {a.notes && !open && <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink-2">{a.notes}</p>}
      {open && (
        <form onSubmit={(e) => { e.preventDefault(); void run(setAssetNotes(a.id, notes), "Notes saved.").then((ok) => ok && setOpen(false)); }} className="mt-2 space-y-2">
          <label className="block text-[13.5px] font-semibold" htmlFor={`n-${a.id}`}>Notes <span className="font-normal text-ink-3">(where the login is kept; never the password itself)</span></label>
          <textarea id={`n-${a.id}`} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
          <button disabled={busy} className={btnSoft}>Save notes</button>
        </form>
      )}
    </li>
  );
}

function HandoverView({ ho, admin, busy, run }: { ho: { lists: Handover[]; items: HandoverItem[] } | null; admin: boolean; busy: boolean; run: Run }) {
  const [term, setTerm] = useState(""); const [cat, setCat] = useState<string | null>(null);
  const current = ho?.lists[0];
  const groups = useMemo(() => { const m = new Map<string, HandoverItem[]>(); for (const i of ho?.items ?? []) m.set(i.category, [...(m.get(i.category) ?? []), i]); return [...m]; }, [ho]);
  const left = (ho?.items ?? []).filter((i) => i.state === "open").length;
  const shownCat = cat ?? groups.find(([, items]) => items.some((i) => i.state === "open"))?.[0] ?? groups[0]?.[0] ?? null;
  if (ho === null) return <p className="text-ink-3">Loading…</p>;
  return (
    <>
      {admin && (!current || current.status === "complete") && (
        <section className={`${card} p-5`} aria-labelledby="start-h">
          <h2 id="start-h" className="text-[18px]">Start a handover</h2>
          <p className="mt-1 text-[14.5px] text-ink-2">Once a year, when the new team takes over. It lists every step from <code>docs/ROLLOVER.md</code> so none is forgotten, and keeps a record of what was done.</p>
          <form onSubmit={(e) => { e.preventDefault(); void run(startHandover(term), "Handover started.").then((ok) => ok && setTerm("")); }} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-[14px] font-semibold">Handing over to the term<input value={term} maxLength={30} onChange={(e) => setTerm(e.target.value)} placeholder="2027-28" className={`${input} mt-1 font-normal`} /></label>
            <button disabled={busy || term.trim().length < 4} className={btn}>Start</button>
          </form>
        </section>
      )}
      {!current ? <p className="text-ink-3">No handover has been started yet.</p> : (
        <section className={card} aria-labelledby="ho-h">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
            <h2 id="ho-h" className="text-[18px]">Handover to {current.term_label}</h2>
            <span className="rounded-full border border-line px-2.5 py-0.5 text-[13px]">{current.status === "complete" ? `Complete ${current.completed_at ? niceDate(current.completed_at.slice(0, 10)) : ""}` : `${left} left`}</span>
            {admin && current.status === "open" && <button disabled={busy || left > 0} onClick={() => void run(completeHandover(current.id), "The handover is complete.")} className={`${btn} ml-auto`}>Mark the handover complete</button>}
          </div>
          <div role="tablist" onKeyDown={tabKeys} aria-label="Steps" className="flex flex-wrap gap-1 border-b border-line px-5 py-2">
            {groups.map(([name, items]) => { const n = items.filter((i) => i.state === "open").length; return (
              <button key={name} role="tab" aria-selected={shownCat === name} tabIndex={(shownCat === name) ? 0 : -1} onClick={() => setCat(name)} className={`rounded-md px-3 py-1.5 text-[14px] ${shownCat === name ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{name.replace(/^\d+\.\s*/, "")} {n > 0 && <span className={shownCat === name ? "text-white/70" : "text-ink-3"}>{n}</span>}</button>
            ); })}
          </div>
          <ul className="divide-y divide-line">
            {(groups.find(([name]) => name === shownCat)?.[1] ?? []).map((i) => <Step key={i.id} i={i} canTick={admin && current.status === "open"} busy={busy} run={run} />)}
          </ul>
        </section>
      )}
    </>
  );
}

function Step({ i, canTick, busy, run }: { i: HandoverItem; canTick: boolean; busy: boolean; run: Run }) {
  const [why, setWhy] = useState(i.note ?? ""); const [asking, setAsking] = useState(false);
  return (
    <li className="px-5 py-3 text-[14.5px]">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span aria-hidden className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[13px] ${i.state === "done" ? "border-[#116329] bg-[#dafbe1] text-[#116329]" : i.state === "waived" ? "border-line bg-soft text-ink-3" : "border-line"}`}>{i.state === "done" ? "✓" : i.state === "waived" ? "–" : ""}</span>
        <span className="min-w-0 flex-1 basis-[240px]">{i.label}<span className="sr-only">, {i.state === "done" ? "done" : i.state === "waived" ? "waived" : "open"}</span>{i.state === "waived" && i.note && <span className="block text-[13.5px] text-ink-3">Waived: {i.note}</span>}</span>
        {canTick && (
          <span className="flex items-center gap-3 text-[13.5px]">
            {i.state !== "done" && <button disabled={busy} onClick={() => void run(setHandoverItem(i.id, "done", ""), "Ticked.")} className="font-semibold underline-offset-4 hover:underline">Done</button>}
            {i.state !== "waived" && <button disabled={busy} onClick={() => setAsking(true)} className="text-ink-2 underline-offset-4 hover:underline">Waive</button>}
            {i.state !== "open" && <button disabled={busy} onClick={() => void run(setHandoverItem(i.id, "open", ""), "Reopened.")} className="text-ink-3 underline-offset-4 hover:underline">Reopen</button>}
          </span>
        )}
      </div>
      {asking && (
        <form onSubmit={(e) => { e.preventDefault(); void run(setHandoverItem(i.id, "waived", why), "Waived.").then((ok) => ok && setAsking(false)); }} className="mt-2 flex flex-wrap gap-2 pl-8">
          <label className="sr-only" htmlFor={`w-${i.id}`}>Why is this waived?</label>
          <input id={`w-${i.id}`} autoFocus value={why} maxLength={300} onChange={(e) => setWhy(e.target.value)} placeholder="Why isn't it needed?" className={`${input} min-w-[200px] flex-1`} />
          <button disabled={busy || why.trim().length < 3} className={btnSoft}>Save</button>
          <button type="button" onClick={() => setAsking(false)} className="px-2 text-ink-3 underline-offset-4 hover:underline">Cancel</button>
        </form>
      )}
    </li>
  );
}
