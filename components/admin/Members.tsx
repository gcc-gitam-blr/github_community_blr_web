"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createMember, exportMembers, importMembers, members as loadMembers, setMemberStatus, updateMember, type ImportReport } from "@/lib/admin/client";
import { RETENTION } from "@/lib/retention";
import { MEMBER_COLUMNS, membersCsv, parseMembersCsv, type Member, type MemberRow } from "@/lib/admin/members";

/* The club's people. Core and admins read; only admins add, edit, change status or import. The database checks every
   rule (create_member, update_member, import_members) and writes each change to the audit log; this page only helps. */
const card = "rounded-[12px] border border-line bg-white";
const btn = "inline-flex items-center justify-center rounded-md bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white transition hover:bg-ink/85 disabled:opacity-50";
const btnSoft = "inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-2.5 text-[14.5px] font-semibold transition hover:bg-soft disabled:opacity-50";
const input = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-[15px]";
const STATUS_LABEL: Record<Member["status"], string> = { active: "Active", alumni: "Alumni", inactive: "Inactive" };
const blank: MemberRow = { handle: "", name: "", email: "", team: "", joined_on: "" };

export function Members({ admin }: { admin: boolean }) {
  const [list, setList] = useState<Member[] | null>(null);
  const [q, setQ] = useState(""); const [show, setShow] = useState<"all" | Member["status"]>("active");
  const [form, setForm] = useState<MemberRow>(blank); const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<{ k: "ok" | "err"; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ rows: MemberRow[]; problem: string | null } | null>(null); const [report, setReport] = useState<ImportReport | null>(null);
  const load = useCallback(async () => setList(await loadMembers()), []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const say = (ok: boolean, t: string) => setNote({ k: ok ? "ok" : "err", t });

  const shown = useMemo(() => (list ?? []).filter((m) => (show === "all" || m.status === show) && `${m.name} ${m.handle ?? ""} ${m.email} ${m.team ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [list, q, show]);
  const counts = useMemo(() => Object.fromEntries((["active", "alumni", "inactive"] as const).map((s) => [s, (list ?? []).filter((m) => m.status === s).length])), [list]);

  const save = async () => {
    setBusy(true); setNote(null);
    const r = editing ? await updateMember(editing, form) : await createMember(form); setBusy(false);
    say(r.ok, r.ok ? (editing ? `Saved ${form.name}.` : `${form.name} is now a member.`) : r.error);
    if (r.ok) { setForm(blank); setEditing(null); await load(); }
  };
  const status = async (m: Member, s: Member["status"]) => {
    setBusy(true); setNote(null); const r = await setMemberStatus(m.id, s); setBusy(false);
    say(r.ok, r.ok ? `${m.name} is now ${STATUS_LABEL[s].toLowerCase()}.` : r.error); if (r.ok) await load();
  };
  const edit = (m: Member) => { setEditing(m.id); setForm({ handle: m.handle ?? "", name: m.name, email: m.email, team: m.team ?? "", joined_on: m.joined_on ?? "" }); document.getElementById("member-name")?.focus(); };

  const pick = async (f: File | undefined) => {
    setReport(null); setNote(null); if (!f) return setFile(null);
    const parsed = parseMembersCsv(await f.text()); setFile(parsed);
    if (!parsed.problem) { setBusy(true); const r = await importMembers(parsed.rows, true); setBusy(false); if ("total" in r) setReport(r); else say(false, r.error); } // checking changes nothing
  };
  const doImport = async () => {
    if (!file || file.problem) return;
    setBusy(true); const r = await importMembers(file.rows, false); setBusy(false);
    if ("total" in r && r.ok) { say(true, `Imported ${r.valid} people.`); setFile(null); setReport(null); await load(); }
    else if ("total" in r) { setReport(r); say(false, "Nothing was imported: fix the rows below and choose the file again."); }
    else say(false, r.error);
  };
  const download = async () => {
    const rows = await exportMembers(); // recorded in the audit log
    if (!rows) return say(false, "Couldn't export. Please try again.");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([membersCsv(rows)], { type: "text/csv" })); a.download = "club-members.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}

      {admin && (
        <section className={`${card} p-5`} aria-labelledby="add-h">
          <h2 id="add-h" className="text-[18px]">{editing ? "Edit member" : "Add a member"}</h2>
          <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[14px] font-semibold">Name<input id="member-name" className={`${input} mt-1 font-normal`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" /></label>
            <label className="text-[14px] font-semibold">Email<input className={`${input} mt-1 font-normal`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" /></label>
            <label className="text-[14px] font-semibold">GitHub username <span className="font-normal text-ink-3">(optional)</span><input className={`${input} mt-1 font-normal`} value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} autoComplete="off" /></label>
            <label className="text-[14px] font-semibold">Team <span className="font-normal text-ink-3">(optional)</span><input className={`${input} mt-1 font-normal`} value={form.team} maxLength={40} onChange={(e) => setForm({ ...form, team: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">Joined on <span className="font-normal text-ink-3">(optional)</span><input className={`${input} mt-1 font-normal`} type="date" value={form.joined_on} onChange={(e) => setForm({ ...form, joined_on: e.target.value })} /></label>
            <div className="flex items-end gap-2">
              <button disabled={busy || !form.name.trim() || !form.email.trim()} className={btn}>{editing ? "Save changes" : "Add member"}</button>
              {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank); }} className={btnSoft}>Cancel</button>}
            </div>
          </form>

          <h3 className="mt-6 text-[16px]">Import from a spreadsheet</h3>
          <p className="mt-1 text-[14px] text-ink-2">A CSV file whose first line names the columns: <code>{MEMBER_COLUMNS.join(", ")}</code> (only name and email are needed, up to 500 people). It is checked first and nothing is saved until you press Import.</p>
          <input type="file" accept=".csv,text/csv" aria-label="Members CSV file" onChange={(e) => void pick(e.target.files?.[0])} className="mt-3 text-[14px]" />
          {file?.problem && <p role="alert" className="mt-3 text-[14.5px] text-[#a40e26]">{file.problem}</p>}
          {report && (
            <div className="mt-3 text-[14.5px]" role="status">
              <p><b>{report.valid}</b> of {report.total} rows are fine{report.errors.length ? <>, <b className="text-[#a40e26]">{report.errors.length} need fixing</b></> : "."}</p>
              {report.errors.length > 0 && <ul className="mt-2 list-disc pl-6 text-[#a40e26]">{report.errors.slice(0, 20).map((e) => <li key={e.row}>Row {e.row} (line {e.row + 1} of the file): {e.error}</li>)}{report.errors.length > 20 && <li>…and {report.errors.length - 20} more</li>}</ul>}
              {report.errors.length === 0 && <button disabled={busy} onClick={() => void doImport()} className={`${btn} mt-3`}>Import {report.valid} people</button>}
            </div>
          )}
        </section>
      )}

      <section className={card} aria-labelledby="list-h">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <h2 id="list-h" className="text-[18px]">Members <span className="ml-1 rounded-full bg-soft px-2 py-0.5 text-[12px] font-normal text-ink-3">{list?.length ?? 0}</span></h2>
          <label className="sr-only" htmlFor="member-find">Search members</label>
          <input id="member-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, GitHub, email, team" className={`${input} !w-auto min-w-[200px] flex-1`} />
          <label className="sr-only" htmlFor="member-show">Show</label>
          <select id="member-show" value={show} onChange={(e) => setShow(e.target.value as typeof show)} className={`${input} !w-auto`}>
            <option value="active">Active ({counts.active ?? 0})</option><option value="alumni">Alumni ({counts.alumni ?? 0})</option><option value="inactive">Inactive ({counts.inactive ?? 0})</option><option value="all">Everyone</option>
          </select>
          {(list?.length ?? 0) > 0 && <button onClick={() => void download()} className={btnSoft}>Download CSV</button>}
        </div>
        {list === null ? <p className="p-5 text-ink-3">Loading…</p> : shown.length === 0 ? <p className="p-5 text-ink-3">{list.length === 0 ? "No members yet. Add one, import a spreadsheet, or onboard a selected applicant under Recruitment." : "Nobody matches."}</p> : (
          <ul className="divide-y divide-line">
            {shown.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[14.5px]">
                <span className="min-w-0 flex-1 basis-[200px]"><b>{m.name}</b>{m.handle && <> <a href={`https://github.com/${m.handle}`} target="_blank" rel="noopener" className="text-ink-3 hover:underline">@{m.handle}</a></>}<span className="block truncate text-[13.5px] text-ink-3">{m.email}{m.team ? ` · ${m.team}` : ""}{m.joined_on ? ` · joined ${m.joined_on}` : ""}</span></span>
                {admin ? (
                  <span className="flex items-center gap-3">
                    <select aria-label={`Status of ${m.name}`} value={m.status} disabled={busy} onChange={(e) => void status(m, e.target.value as Member["status"])} className={`${input} !w-auto !py-1.5 !text-[14px]`}>
                      {(["active", "alumni", "inactive"] as const).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    <button onClick={() => edit(m)} className="text-ink-2 underline-offset-4 hover:underline" aria-label={`Edit ${m.name}`}>Edit</button>
                  </span>
                ) : <span className="rounded-full border border-line px-2.5 py-0.5 text-[13px]">{STATUS_LABEL[m.status]}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-[13.5px] text-ink-3">People who stay inactive for {RETENTION.membersMonths} months are deleted automatically; active members and alumni are kept. Every change here is recorded in the audit log.</p>
    </div>
  );
}
