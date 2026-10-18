"use client";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, LinkExternalIcon, PlusIcon, TrashIcon } from "@primer/octicons-react";
import { DEFAULT_QUESTIONS, DEFAULT_TEAMS, LIMITS, QUESTION_TYPES, formProblem, hasOptions, newQuestionId, type Question, type QuestionType } from "@/lib/apply";
import { setCampaignForm, type Campaign } from "@/lib/admin/client";
import { btn, btnSoft, input } from "./kit";

/* A round's form, built like a Google Form: an introduction, the questions (short answer, paragraph, multiple choice,
   checkboxes, dropdown, a 1-to-5 scale, a link), and the teams people can pick from. Name, email and GitHub username
   are always asked. Admins edit; the database checks the form again when it is saved. */
type Run = (p: Promise<{ ok: boolean; error?: string }>, done: string, after?: () => Promise<void>) => Promise<void>;
const optionsText = (q: Question) => (q.options ?? []).join("\n");
const toOptions = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function RecruitForm({ round, applied, busy, run, reload }: { round: Campaign; applied: number; busy: boolean; run: Run; reload: () => Promise<void> }) {
  const start = { intro: round.intro ?? "", questions: round.questions?.length ? round.questions : DEFAULT_QUESTIONS, teams: (round.teams ?? DEFAULT_TEAMS).join(", ") };
  const [intro, setIntro] = useState(start.intro);
  const [qs, setQs] = useState<Question[]>(start.questions);
  const [raw, setRaw] = useState<Record<string, string>>(Object.fromEntries(start.questions.map((q) => [q.id, optionsText(q)]))); // what's typed in each options box
  const [teams, setTeams] = useState(start.teams);
  const [copied, setCopied] = useState(false);

  const cleaned = qs.map((q): Question => ({ id: q.id, type: q.type, label: q.label.trim(), ...(q.help?.trim() ? { help: q.help.trim() } : {}), required: q.required, ...(hasOptions(q.type) ? { options: toOptions(raw[q.id] ?? "") } : {}) }));
  const teamList = teams.split(",").map((t) => t.trim()).filter(Boolean);
  const form = { intro: intro.trim() || null, questions: cleaned, teams: teamList };
  const dirty = JSON.stringify(form) !== JSON.stringify({ intro: start.intro.trim() || null, questions: start.questions, teams: start.teams.split(",").map((t) => t.trim()).filter(Boolean) });
  const problem = formProblem(form);

  const edit = (i: number, patch: Partial<Question>) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, by: -1 | 1) => { const next = [...qs]; [next[i], next[i + by]] = [next[i + by], next[i]]; setQs(next); };
  const add = () => { const q: Question = { id: newQuestionId(), type: "short", label: "", required: false }; setQs([...qs, q]); requestAnimationFrame(() => document.getElementById(`ql-${q.id}`)?.focus()); };
  const retype = (i: number, type: QuestionType) => { const q = qs[i]; if (hasOptions(type) && !toOptions(raw[q.id] ?? "").length) setRaw({ ...raw, [q.id]: "Option 1\nOption 2" }); edit(i, { type }); };
  const link = typeof window === "undefined" ? "/apply" : `${window.location.origin}/apply`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the link is also shown */ } };

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-soft px-4 py-3 text-[14px] text-ink-2">
        <span className="min-w-0 flex-1 basis-[260px]">People apply at <b className="font-mono text-ink">/apply</b> while the round is open. Name, email and GitHub username are always asked.</span>
        <button type="button" onClick={copy} className={btnSoft}><CopyIcon size={14} aria-hidden />{copied ? "Copied" : "Copy the link"}</button>
        <a href="/apply" target="_blank" rel="noopener" className={btnSoft}>Open it <LinkExternalIcon size={14} aria-hidden /></a>
      </div>
      {applied > 0 && <p className="rounded-md bg-[#fff8c5] px-4 py-3 text-[14px] text-[#4d2d00]">{applied} {applied === 1 ? "person has" : "people have"} applied already. Rewording a question keeps their answers; removing one hides its answers here (they stay in the CSV).</p>}

      <label className="block text-[14px] font-semibold">Introduction <span className="font-normal text-ink-3">(optional; shown at the top of the form)</span>
        <textarea rows={2} maxLength={LIMITS.intro} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="What the core team does, how much time it takes, and when you'll reply." className={`${input} mt-1 font-normal`} />
      </label>

      <ol className="space-y-3">
        {qs.map((q, i) => (
          <li key={q.id} className="rounded-[12px] border border-line bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-[28px_minmax(0,1fr)_190px]">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-soft font-mono text-[12.5px] font-bold text-ink-2">{i + 1}</span>
              <label className="block text-[13px] font-semibold">Question {i + 1}
                <input id={`ql-${q.id}`} value={q.label} maxLength={LIMITS.label} onChange={(e) => edit(i, { label: e.target.value })} placeholder="What would you like to ask?" className={`${input} mt-1 font-normal`} />
              </label>
              <label className="block text-[13px] font-semibold">Answer type
                <select value={q.type} onChange={(e) => retype(i, e.target.value as QuestionType)} className={`${input} mt-1 font-normal`}>
                  {QUESTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className="block text-[13px] font-semibold sm:col-start-2">Help text <span className="font-normal text-ink-3">(optional)</span>
                <input value={q.help ?? ""} maxLength={LIMITS.help} onChange={(e) => edit(i, { help: e.target.value })} placeholder="An example, or how long an answer you'd like" className={`${input} mt-1 font-normal`} />
              </label>
              {hasOptions(q.type) && (
                <label className="block text-[13px] font-semibold sm:col-start-2 sm:col-end-4">Options <span className="font-normal text-ink-3">(one per line)</span>
                  <textarea rows={Math.min(8, Math.max(2, toOptions(raw[q.id] ?? "").length + 1))} value={raw[q.id] ?? ""} onChange={(e) => setRaw({ ...raw, [q.id]: e.target.value })} className={`${input} mt-1 font-normal`} />
                </label>
              )}
              <div className="flex flex-wrap items-center gap-1 sm:col-start-2 sm:col-end-4">
                <label className="mr-auto flex cursor-pointer items-center gap-2 text-[14px] font-semibold"><input type="checkbox" checked={q.required} onChange={(e) => edit(i, { required: e.target.checked })} /> Required</label>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move question ${i + 1} up`} className="rounded-md p-2 text-ink-2 transition-colors hover:bg-soft disabled:opacity-30"><ArrowUpIcon size={16} /></button>
                <button type="button" disabled={i === qs.length - 1} onClick={() => move(i, 1)} aria-label={`Move question ${i + 1} down`} className="rounded-md p-2 text-ink-2 transition-colors hover:bg-soft disabled:opacity-30"><ArrowDownIcon size={16} /></button>
                <button type="button" disabled={qs.length === 1} onClick={() => setQs(qs.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`} className="rounded-md p-2 text-[#a40e26] transition-colors hover:bg-[#ffebe9] disabled:opacity-30"><TrashIcon size={16} /></button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {qs.length < LIMITS.questions && <button type="button" onClick={add} className={btnSoft}><PlusIcon size={14} aria-hidden />Add a question</button>}

      <label className="block text-[14px] font-semibold">Teams people can pick <span className="font-normal text-ink-3">(separated by commas; leave empty to not ask)</span>
        <input value={teams} onChange={(e) => setTeams(e.target.value)} className={`${input} mt-1 font-normal`} />
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button disabled={busy || !dirty || !!problem} onClick={() => void run(setCampaignForm(round.id, form), "Saved the form.", reload)} className={btn}>Save the form</button>
        {dirty && problem && <span role="status" className="text-[14px] text-[#a40e26]">{problem}</span>}
        {!dirty && <span className="text-[14px] text-ink-3">No changes yet.</span>}
      </div>
    </div>
  );
}
