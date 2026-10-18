"use client";
import { useState } from "react";
import { MailIcon } from "@primer/octicons-react";
import { answerText, hasOptions, type Question } from "@/lib/apply";
import { csvCell } from "@/lib/admin/members";
import { emailApplicants, exportApplications, type ApplicantGroup, type Application, type ApplicationStatus, type Campaign, type Decision, type Review } from "@/lib/admin/client";
import { useConfirm } from "@/components/ui/Confirm";
import { Note, btn, input } from "./kit";

/* A round's responses three ways, the way a recruitment team works through them: a summary per question (like Google
   Forms), a table of everyone's answers side by side, and the CSV for a spreadsheet. Plus one email to a group of
   applicants: interview invites, offers, the waiting list, or a kind no. */
const pct = (n: number, of: number) => `${Math.round((n / Math.max(of, 1)) * 100)}%`;
const short = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Bars({ rows, of }: { rows: [string, number][]; of: number }) {
  const top = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <ul className="mt-2.5 space-y-2">
      {rows.map(([label, n]) => (
        <li key={label} className="text-[14px]">
          <div className="flex justify-between gap-3"><span className="min-w-0 truncate">{label}</span><span className="whitespace-nowrap font-mono text-[13px] text-ink-2">{n} · {pct(n, of)}</span></div>
          <div className="mt-1 h-2 rounded-full bg-soft"><div className="h-2 rounded-full bg-node-purple" style={{ width: `${(n / top) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** One card per question: counts for choices, the average on a scale, a few answers for written ones. */
export function Summary({ questions, teams, apps, showTable }: { questions: Question[]; teams: string[]; apps: Application[]; showTable: () => void }) {
  if (!apps.length) return <p className="px-5 py-6 text-ink-3">No responses yet. They appear here as people apply.</p>;
  const n = apps.length;
  const card = "rounded-[12px] border border-line p-4";
  return (
    <div className="grid gap-3 px-5 py-5 md:grid-cols-2">
      {teams.length > 0 && (
        <section className={card}>
          <h4 className="text-[15px]">Team they prefer</h4>
          <Bars of={n} rows={[...teams.map((t): [string, number] => [t, apps.filter((a) => a.team_pref === t).length]), ["No preference", apps.filter((a) => !a.team_pref).length]]} />
        </section>
      )}
      {questions.map((q) => {
        const given = apps.map((a) => a.answers?.[q.id]).filter((v) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
        if (hasOptions(q.type)) {
          const count = (o: string) => given.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length;
          return <section key={q.id} className={card}><h4 className="text-[15px]">{q.label}</h4><p className="mt-0.5 text-[13px] text-ink-3">{given.length} of {n} answered{q.type === "checkboxes" ? " · they could tick several" : ""}</p><Bars of={n} rows={(q.options ?? []).map((o) => [o, count(o)])} /></section>;
        }
        if (q.type === "scale") {
          const nums = given.map((v) => Number(v)).filter((x) => x >= 1 && x <= 5), avg = nums.length ? (nums.reduce((s, x) => s + x, 0) / nums.length).toFixed(1) : "–";
          return <section key={q.id} className={card}><h4 className="text-[15px]">{q.label}</h4><p className="mt-0.5 text-[13px] text-ink-3">Average <b className="font-mono text-ink">{avg}</b> of 5 · {nums.length} answered</p><Bars of={nums.length} rows={["1", "2", "3", "4", "5"].map((s) => [s, nums.filter((x) => String(x) === s).length])} /></section>;
        }
        const latest = [...given].reverse().slice(0, 3).map((v) => answerText(v));
        return (
          <section key={q.id} className={card}>
            <h4 className="text-[15px]">{q.label}</h4>
            <p className="mt-0.5 text-[13px] text-ink-3">{given.length} of {n} answered</p>
            <ul className="mt-2.5 space-y-2">{latest.map((t, i) => <li key={i} className="rounded-md bg-soft px-3 py-2 text-[14px] leading-snug"><span className="line-clamp-3">{t}</span></li>)}</ul>
            {given.length > 3 && <button onClick={showTable} className="mt-2 text-[14px] font-semibold text-link underline-offset-4 hover:underline">See all {given.length} in the table</button>}
          </section>
        );
      })}
    </div>
  );
}

/** Everyone's answers side by side, like the sheet behind a Google Form. Scrolls sideways; the names stay put. */
export function ResponseTable({ questions, apps, score, status }: { questions: Question[]; apps: Application[]; score: (id: number) => number | null; status: Record<ApplicationStatus, string> }) {
  if (!apps.length) return <p className="px-5 py-6 text-ink-3">No responses yet.</p>;
  const cell = "max-w-[280px] px-3 py-2.5 align-top";
  return (
    <div role="region" aria-label="All responses (scrolls sideways)" tabIndex={0} className="relative overflow-x-auto outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-link">
      <table className="w-max min-w-full text-left text-[13.5px]">
        <thead className="bg-soft text-[12.5px] text-ink-2">
          <tr>
            <th scope="col" className="sticky left-0 z-[1] bg-soft px-4 py-2.5 font-semibold">Name</th>
            {["GitHub", "Email", "Team", "Status", "Applied", "Score"].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>)}
            {questions.map((q) => <th key={q.id} scope="col" className="max-w-[280px] px-3 py-2.5 font-semibold">{q.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} className="border-t border-line">
              <th scope="row" className="sticky left-0 z-[1] bg-white px-4 py-2.5 align-top font-semibold">{a.name}</th>
              <td className={cell}><a href={`https://github.com/${a.handle}`} target="_blank" rel="noopener" className="text-link hover:underline">@{a.handle}</a></td>
              <td className={`${cell} text-ink-2`}>{a.email}</td>
              <td className={cell}>{a.team_pref ?? ""}</td>
              <td className={`${cell} whitespace-nowrap`}>{status[a.status]}</td>
              <td className={`${cell} whitespace-nowrap text-ink-2`}>{short(a.created_at)}</td>
              <td className={`${cell} font-mono`}>{score(a.id) ?? ""}</td>
              {questions.map((q) => { const t = answerText(a.answers?.[q.id]); return <td key={q.id} className={cell}><span className="line-clamp-4 whitespace-pre-line" title={t.length > 140 ? t : undefined}>{t}</span></td>; })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The round as a CSV for Google Sheets or Excel: one row per applicant, one column per question. The download is logged. */
export async function downloadResponses(round: Campaign, questions: Question[], reviews: Review[], decisions: Decision[], status: Record<ApplicationStatus, string>): Promise<string | null> {
  const rows = await exportApplications(round.id);
  if (!rows) return "Couldn't download the responses. Please try again.";
  const avg = (id: number) => { const s = reviews.filter((r) => r.application_id === id).map((r) => r.score); return s.length ? (s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) : ""; };
  const head = ["Name", "Email", "GitHub", "Team", "Status", "Applied", "Average score", "Decision", "Reason", ...questions.map((q) => q.label)];
  const lines = rows.map((a) => { const d = decisions.find((x) => x.application_id === a.id); return [a.name, a.email, a.handle, a.team_pref ?? "", status[a.status], a.created_at.slice(0, 10), avg(a.id), d ? status[d.decision] : "", d?.reason ?? "", ...questions.map((q) => answerText(a.answers?.[q.id]))]; });
  const body = [head, ...lines].map((r) => r.map((c) => csvCell(String(c))).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
  a.download = `${round.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-responses.csv`; a.click(); URL.revokeObjectURL(a.href);
  return null;
}

/* Ready wording for each group, to edit before sending. */
const TEMPLATES: Record<ApplicantGroup, { label: string; subject: (round: string) => string; message: string }> = {
  interview: { label: "Invited to interview", subject: (r) => `${r}: let's talk`, message: "Thanks for applying. We'd like to meet you for a short conversation, about 15 minutes.\n\nReply to this email with two times that suit you this week, and we'll confirm one." },
  selected: { label: "Selected", subject: () => "Welcome to the core team", message: "We're happy to tell you that you've been selected for the core team.\n\nWe'll add you to the team's group this week, and see you at the next meeting. Reply to this email if you have any questions." },
  waitlisted: { label: "Waiting list", subject: (r) => `About your application to ${r}`, message: "Thank you for applying. We liked your application and we've put you on our waiting list: if a place opens this term, we'll write to you first." },
  rejected: { label: "Not selected", subject: (r) => `About your application to ${r}`, message: "Thank you for applying, and for the time you put into it. We couldn't offer you a place this time.\n\nOur events are open to everyone, and we'd love to see you there. You're welcome to apply again next round." },
  all: { label: "Everyone who applied", subject: (r) => `${r}: an update`, message: "" },
};

export function EmailApplicants({ round, apps }: { round: Campaign; apps: Application[] }) {
  const counts: Record<ApplicantGroup, number> = { interview: 0, selected: 0, waitlisted: 0, rejected: 0, all: apps.filter((a) => a.status !== "withdrawn").length };
  for (const a of apps) if (a.status in counts && a.status !== "withdrawn") counts[a.status as ApplicantGroup]++;
  const [group, setGroup] = useState<ApplicantGroup | null>(null);
  const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [note, setNote] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const [ask, dialog] = useConfirm();
  const pick = (g: ApplicantGroup) => {
    // start from the ready wording, unless the organiser has already written their own
    const was = group ? TEMPLATES[group] : null;
    if (!subject || (was && subject === was.subject(round.name))) setSubject(TEMPLATES[g].subject(round.name));
    if (!message || (was && message === was.message)) setMessage(TEMPLATES[g].message);
    setGroup(g); setNote(null);
  };
  const n = group ? counts[group] : 0;
  const send = async () => {
    if (!group || !(await ask({ title: `Email ${n} ${n === 1 ? "applicant" : "applicants"}?`, body: <>Each gets their own email, starting &ldquo;Hi&rdquo; and their first name. Subject: <b>{subject}</b>. Emails can&apos;t be called back once they&apos;re sent.</>, yes: `Send to ${n}` }))) return;
    setBusy(true); setNote(null);
    const r = await emailApplicants(round.id, group, subject, message); setBusy(false);
    setNote(r.ok ? { k: r.failed ? "err" : "ok", t: `Sent to ${r.sent} of ${r.total}.${r.failed ? ` ${r.failed} failed. ${r.problem ?? ""}` : ""}` } : { k: "err", t: r.error });
  };
  return (
    <div className="space-y-4 px-5 py-5">
      {dialog}
      <fieldset>
        <legend className="mb-2 text-[14px] font-semibold">Who it goes to</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMPLATES) as ApplicantGroup[]).map((g) => (
            <label key={g} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors has-[:disabled]:cursor-default has-[:disabled]:opacity-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-link ${group === g ? "border-ink bg-ink font-semibold text-white" : "border-line hover:border-ink/40"}`}>
              <input type="radio" name={`grp-${round.id}`} disabled={!counts[g]} checked={group === g} onChange={() => pick(g)} className="sr-only" />{TEMPLATES[g].label} <span className="font-mono text-[12px] opacity-75">{counts[g]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {group && (<>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} aria-label="Subject" className={input} />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={5000} aria-label="Message" placeholder="Write your message. A blank line starts a new paragraph." className={input} />
        <p className="text-[13.5px] text-ink-3">Each email starts &ldquo;Hi&rdquo; and their first name, and ends with the club&apos;s name. Replies come to the club&apos;s address.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={busy || !n || subject.trim().length < 3 || message.trim().length < 10} onClick={send} className={btn}><MailIcon size={16} aria-hidden />{busy ? "Sending…" : `Send to ${n} ${n === 1 ? "applicant" : "applicants"}`}</button>
          <Note note={note} />
        </div>
      </>)}
      {!group && <p className="text-[14px] text-ink-3">Pick a group to start from ready wording you can edit. The counts come from each applicant&apos;s stage in Review.</p>}
    </div>
  );
}
