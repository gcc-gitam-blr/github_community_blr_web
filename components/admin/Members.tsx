"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createMember, exportMembers, importMembers, memberHistory, members as loadMembers, setMemberStatus, updateMember, type ImportReport, type MemberHistory } from "@/lib/admin/client";
import { RETENTION } from "@/lib/retention";
import { membersCsv, parseMembersCsv, parseMembersTable, type Member, type MemberRow, type Parsed } from "@/lib/admin/members";
import { CLUB } from "@/lib/config";
import { Composer, Role, State, btn, btnSoft, card, count, head, input, pillSelect, toneCls, type Tone } from "./kit";

/* The club's people. Core and admins read; only admins add, edit, change status or import. The database checks every
   rule (create_member, update_member, import_members) and writes each change to the audit log; this page only helps. */
const STATUS_LABEL: Record<Member["status"], string> = { active: "Active", alumni: "Alumni", inactive: "Inactive" };
const TONE: Record<Member["status"], Tone> = { active: "live", alumni: "done", inactive: "muted" };
/** Their GitHub picture, or their initials when the record has no username. */
function Face({ m }: { m: Member }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (m.handle) return <img src={`https://github.com/${m.handle}.png?size=72`} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 flex-none rounded-full border border-line bg-soft" />;
  return <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-full bg-soft font-mono text-[13px] font-bold text-ink-2">{m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>;
}
const blank: MemberRow = { handle: "", name: "", email: "", team: "", joined_on: "" };

export function Members({ admin }: { admin: boolean }) {
  const [list, setList] = useState<Member[] | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [hist, setHist] = useState<Record<string, MemberHistory>>({});
  const toggle = async (m: Member) => { if (open === m.id) return setOpen(null); setOpen(m.id); if (!hist[m.id]) { const h = await memberHistory(m); setHist((x) => ({ ...x, [m.id]: h })); } };
  const [q, setQ] = useState(""); const [show, setShow] = useState<"all" | Member["status"]>("active");
  const [form, setForm] = useState<MemberRow>(blank); const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<{ k: "ok" | "err"; t: string } | null>(null); const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<(Parsed & { name: string }) | null>(null); const [report, setReport] = useState<ImportReport | null>(null);
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
  const edit = (m: Member) => { setEditing(m.id); setForm({ handle: m.handle ?? "", name: m.name, email: m.email, team: m.team ?? "", joined_on: m.joined_on ?? "" }); requestAnimationFrame(() => document.getElementById("member-name")?.focus()); };

  const pick = async (f: File | undefined) => {
    setReport(null); setNote(null); if (!f) return setFile(null);
    // Excel (.xlsx) is read here in the browser; .xls (Excel 97) and Numbers files have to be saved as .xlsx or CSV first
    let parsed: Parsed;
    if (/\.xlsx$/i.test(f.name)) {
      try { parsed = parseMembersTable(await (await import("@/lib/admin/xlsx")).readXlsx(await f.arrayBuffer())); }
      catch { parsed = { rows: [], columns: [], notes: [], problem: "That file couldn't be read as Excel. In Excel or Google Sheets, save it again as .xlsx or as CSV, and choose it again." }; }
    } else if (/\.(xls|numbers|ods)$/i.test(f.name)) parsed = { rows: [], columns: [], notes: [], problem: "That's an older or non-Excel spreadsheet format. Open it and save it as .xlsx (Excel) or CSV, then choose it again." };
    else parsed = parseMembersCsv(await f.text());
    setFile({ ...parsed, name: f.name });
    if (!parsed.problem) { setBusy(true); const r = await importMembers(parsed.rows, true); setBusy(false); if ("total" in r) setReport(r); else say(false, r.error); } // checking changes nothing
  };
  const doImport = async () => {
    if (!file || file.problem) return;
    setBusy(true); const r = await importMembers(file.rows, false); setBusy(false);
    if ("total" in r && r.ok) { say(true, [r.added ? `Added ${r.added} ${r.added === 1 ? "person" : "people"}` : "", r.updated ? `filled in details for ${r.updated}` : "", r.unchanged ? `${r.unchanged} already up to date` : ""].filter(Boolean).join(", ").replace(/^./, (x) => x.toUpperCase()) + "."); setFile(null); setReport(null); await load(); }
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
        <Composer id="add-h" title={editing ? "Edit member" : "Add or import members"} forceOpen={editing !== null}>
          <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-3 sm:grid-cols-2">
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
          <p className="mt-1 text-[14px] text-ink-2">An Excel (.xlsx) or CSV file, straight from Google Sheets or Excel: the first row names the columns. Only a <b>name</b> and an <b>email</b> are needed; a <b>GitHub username</b> is what lets someone into the hub when the email in the sheet isn&apos;t the one on their GitHub. Team and joined date are optional, and other columns are ignored. Up to 500 people.</p>
          <p className="mt-1 text-[14px] text-ink-2">People already on the list are kept as they are: the file only fills in what their record is missing, so you can import the same sheet again after updating it. It&apos;s checked first; nothing is saved until you press Import.</p>
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Members spreadsheet (Excel or CSV)" onChange={(e) => void pick(e.target.files?.[0])} className="mt-3 text-[14px]" />
          {file && file.columns.length > 0 && (
            <p className="mt-3 text-[13.5px] text-ink-2">From <b>{file.name}</b>, reading {file.columns.map((c, i) => <span key={c.field}>{i > 0 && ", "}<b>{c.from}</b> as {({ handle: "GitHub username", name: "name", email: "email", team: "team", joined_on: "joined date" } as const)[c.field]}</span>)}.
              {!file.columns.some((c) => c.field === "handle") && <span className="text-[#9a6700]"> No GitHub username column: people will be linked by email only.</span>}</p>
          )}
          {file?.notes.map((n) => <p key={n} className="mt-1 text-[13.5px] text-[#9a6700]">{n}</p>)}
          {file?.problem && <p role="alert" className="mt-3 text-[14.5px] text-[#a40e26]">{file.problem}</p>}
          {report && (
            <div className="mt-3 text-[14.5px]" role="status">
              <p><b>{report.valid}</b> of {report.total} rows are fine{report.errors.length ? <>, <b className="text-[#a40e26]">{report.errors.length} need fixing</b></> : "."}
                {report.added !== undefined && <span className="text-ink-2"> {report.added} new, {report.updated} with details to fill in, {report.unchanged} already up to date.</span>}</p>
              {report.errors.length > 0 && <ul className="mt-2 list-disc pl-6 text-[#a40e26]">{report.errors.slice(0, 20).map((e) => <li key={e.row}>Row {e.row} (line {e.row + 1} of the file): {e.error}</li>)}{report.errors.length > 20 && <li>…and {report.errors.length - 20} more</li>}</ul>}
              {(report.notes?.length ?? 0) > 0 && <ul className="mt-2 list-disc pl-6 text-[#9a6700]">{report.notes!.slice(0, 10).map((n) => <li key={n.row}>Row {n.row}: {n.note}</li>)}</ul>}
              {report.errors.length === 0 && ((report.added ?? report.valid) + (report.updated ?? 0) > 0
                ? <button disabled={busy} onClick={() => void doImport()} className={`${btn} mt-3`}>Import{report.added ? ` ${report.added} new` : ""}{report.updated ? `${report.added ? " and" : ""} update ${report.updated}` : ""}</button>
                : <p className="mt-2 text-ink-2">Everyone in this file is already on the list with these details. Nothing to import.</p>)}
            </div>
          )}
        </Composer>
      )}

      <section className={card} aria-labelledby="list-h">
        <div className={head}>
          <h2 id="list-h" className="text-[18px]">Members</h2><span className={count}>{list?.length ?? 0}</span>
          {(list?.length ?? 0) > 0 && <button onClick={() => void download()} className={`${btnSoft} ml-auto`}>Download CSV</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div role="group" aria-label="Show" className="flex flex-wrap gap-1">
            {([["active", "Active"], ["alumni", "Alumni"], ["inactive", "Inactive"], ["all", "Everyone"]] as const).map(([s, l]) => (
              <button key={s} aria-pressed={show === s} onClick={() => setShow(s)} className={`rounded-full px-3 py-1 text-[13.5px] transition-colors duration-150 ${show === s ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{l} <span className="font-mono text-[12px] opacity-75">{s === "all" ? list?.length ?? 0 : counts[s] ?? 0}</span></button>
            ))}
          </div>
          <label className="sr-only" htmlFor="member-find">Search members</label>
          <input id="member-find" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, GitHub, email, team" className={`${input} !w-auto min-w-[200px] flex-1 !py-2`} />
        </div>
        {list === null ? <p className="p-5 text-ink-3">Loading…</p> : shown.length === 0 ? <p className="p-5 text-ink-3">{list.length === 0 ? "No members yet. Add one, import a spreadsheet, or onboard a selected applicant under Recruitment." : "Nobody matches."}</p> : (
          <ul className="divide-y divide-line">
            {shown.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[14.5px]">
                <Face m={m} />
                <span className="min-w-0 flex-1 basis-[200px]"><b>{m.name}</b>{m.handle && <> <a href={`https://github.com/${m.handle}`} target="_blank" rel="noopener" className="text-ink-3 hover:underline">@{m.handle}</a></>}<span className="block truncate text-[13.5px] text-ink-3">{m.email}{m.team ? ` · ${m.team}` : ""}{m.joined_on ? ` · joined ${m.joined_on}` : ""}</span>
                  {/* linked = their sign-in is attached to this record, which is what opens the hub and My club to them */}
                  {m.status === "active" && <span className={`mt-0.5 block text-[12.5px] ${m.user_id ? "text-[#116329]" : "text-[#9a6700]"}`}>{m.user_id ? "Signed in: the hub is open to them" : m.handle ? "Hasn't signed in with GitHub yet" : "Hasn't signed in yet. Add their GitHub username so it links even if their GitHub email differs"}</span>}</span>
                {admin ? (
                  <span className="flex items-center gap-3">
                    <select aria-label={`Status of ${m.name}`} value={m.status} disabled={busy} onChange={(e) => void status(m, e.target.value as Member["status"])} className={`${pillSelect} ${toneCls(TONE[m.status])}`}>
                      {(["active", "alumni", "inactive"] as const).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    <button onClick={() => edit(m)} className="text-ink-2 underline-offset-4 hover:underline" aria-label={`Edit ${m.name}`}>Edit</button>
                  </span>
                ) : <State tone={TONE[m.status]}>{STATUS_LABEL[m.status]}</State>}
                <button onClick={() => void toggle(m)} aria-expanded={open === m.id} className="text-ink-2 underline-offset-4 hover:underline" aria-label={`History of ${m.name}`}>{open === m.id ? "Close" : "History"}</button>
                {open === m.id && <History h={hist[m.id]} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-[13.5px] text-ink-3">People who stay inactive for {RETENTION.membersMonths} months are deleted automatically; active members and alumni are kept. Every change here is recorded in the audit log.</p>
    </div>
  );
}

/** One member at a glance: events they came to, their access, their projects and what they're into. */
function History({ h }: { h?: MemberHistory }) {
  if (!h) return <div className="h-16 basis-full" aria-busy="true" />;
  const box = "rounded-lg bg-soft px-4 py-3";
  return (
    <div className="mt-2 grid basis-full gap-3 sm:grid-cols-2">
      <div className={box}>
        <p className="font-mono text-[12px] text-ink-3">Came to {h.events.length} of {CLUB.events.length} events</p>
        {/* the year's events as squares, like their own year on My club: green where they came */}
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {CLUB.events.map((e) => { const came = h.events.some((x) => x.event === e.date); return <li key={e.date} title={`${e.title}${came ? ": came" : ""}`} className={`relative h-4 w-4 rounded-[4px] ${came ? "bg-[#2ea043]" : "bg-[#ebeef0]"}`}><span className="sr-only">{e.title}: {came ? "came" : "didn't come"}</span></li>; })}
        </ul>
        {h.events.length > 0 && <p className="mt-2 text-[13.5px] text-ink-2">{h.events.map((e) => e.title).join(" · ")}</p>}
      </div>
      <div className={box}><p className="font-mono text-[12px] text-ink-3">Access</p><p className="mt-1.5 text-[14px]">{h.role ? <><Role role={h.role.role}>{h.role.role}</Role> {h.role.title ? ` ${h.role.title}` : ""}{h.role.ends_on ? <span className="text-ink-2"> · until {h.role.ends_on}</span> : ""}</> : <span className="text-ink-2">No organiser access (or hasn&apos;t signed in).</span>}</p></div>
      <div className={box}><p className="font-mono text-[12px] text-ink-3">Projects · {h.projects.length}</p>{h.projects.length ? <ul className="mt-1 text-[14px]">{h.projects.map((p) => <li key={p.id}>{p.title} <span className="text-ink-3">{p.status}{p.owner ? " · owner" : ""}</span></li>)}</ul> : <p className="mt-1 text-[14px] text-ink-2">Not on a project yet.</p>}</div>
      <div className={box}><p className="font-mono text-[12px] text-ink-3">Into</p>{h.interests ? <p className="mt-1 text-[14px]">{h.interests.domains.join(", ")}{h.interests.skills.length ? <span className="block font-mono text-[13px] text-ink-2">{h.interests.skills.join(", ")}</span> : null}{h.interests.wants ? <span className="block text-ink-2">&ldquo;{h.interests.wants}&rdquo;</span> : null}</p> : <p className="mt-1 text-[14px] text-ink-2">Hasn&apos;t filled in the project hub survey.</p>}</div>
    </div>
  );
}
