"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addReviewer, applications as loadApplications, campaigns as loadCampaigns, createCampaign, decideApplication, moveApplication, onboardApplication, removeReviewer,
  reviewApplication, reviewers as loadReviewers, setCampaignDates, setCampaignStatus,
  type Application, type ApplicationStatus, type Campaign, type Decision, type Review,
} from "@/lib/admin/client";
import { DownloadIcon } from "@primer/octicons-react";
import { tabKeys } from "@/components/ui/tabKeys";
import { DEFAULT_QUESTIONS, DEFAULT_TEAMS, answerText, type Question } from "@/lib/apply";
import { todayIST, niceDate } from "@/lib/admin/appointments";
import { RETENTION } from "@/lib/retention";
import { Composer, State, btn, btnSoft, card, count, head, input, type Tone } from "./kit";
import { RecruitForm } from "./RecruitForm";
import { EmailApplicants, ResponseTable, Summary, downloadResponses } from "./RecruitResponses";

/* Recruitment rounds, each with its own form (like a Google Form). Admins build the form, open and close rounds, choose
   the reviewers, record decisions and email applicants; an assigned reviewer reads that round's applications and adds a
   score and notes. Responses read three ways: Review (the pipeline), Summary (per question) and Table (side by side). The database enforces who may do what and which status
   can follow which (supabase/schema.sql), including that nobody reviews or decides their own application. */
const STATUS: Record<ApplicationStatus, string> = { submitted: "New", screening: "Screening", interview: "Interview", selected: "Selected", waitlisted: "Waitlisted", rejected: "Not selected", withdrawn: "Withdrawn", onboarded: "Member" };
const TONE: Record<ApplicationStatus, Tone> = { submitted: "new", screening: "waiting", interview: "waiting", selected: "ok", waitlisted: "waiting", rejected: "no", withdrawn: "muted", onboarded: "done" };
const CAMPAIGN_STATUS: Record<Campaign["status"], string> = { draft: "Draft", open: "Open", closed: "Closed", archived: "Archived" };
const CAMPAIGN_TONE: Record<Campaign["status"], Tone> = { draft: "draft", open: "live", closed: "done", archived: "muted" };
// the way through a round, drawn like a branch: each stage a commit, filled once someone is there
const FLOW: ApplicationStatus[] = ["submitted", "screening", "interview", "selected", "onboarded"];
const ASIDE: ApplicationStatus[] = ["waitlisted", "rejected", "withdrawn"];
type Note = { k: "ok" | "err"; t: string } | null;

export function Recruitment({ admin, meId }: { admin: boolean; meId: string }) {
  const [rounds, setRounds] = useState<Campaign[] | null>(null); const [sel, setSel] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", year: "", opens: todayIST(), closes: "" });
  const load = useCallback(async () => { const c = await loadCampaigns(); setRounds(c); setSel((cur) => cur ?? c[0]?.id ?? null); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const say = (ok: boolean, t: string) => setNote({ k: ok ? "ok" : "err", t });
  const round = rounds?.find((c) => c.id === sel) ?? null;

  const create = async () => {
    setBusy(true); setNote(null); const r = await createCampaign(f.name, f.year, f.opens, f.closes); setBusy(false);
    say(r.ok, r.ok ? `Created ${f.name} as a draft. Add reviewers, then open it.` : r.error);
    if (r.ok) { setF({ name: "", year: "", opens: todayIST(), closes: "" }); setSel(r.id); await load(); }
  };

  return (
    <div className="space-y-4">
      {note && <p role={note.k === "err" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-[14.5px] ${note.k === "err" ? "bg-[#ffebe9] text-[#a40e26]" : "bg-[#dafbe1] text-[#116329]"}`}>{note.t}</p>}
      {admin && (
        <Composer id="new-h" title="Start a recruitment round">
          <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="grid gap-3 sm:grid-cols-2">
            <label className="text-[14px] font-semibold">Name<input className={`${input} mt-1 font-normal`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Core team 2026-27" /></label>
            <label className="text-[14px] font-semibold">Club year<input className={`${input} mt-1 font-normal`} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} placeholder="2026-27" /></label>
            <label className="text-[14px] font-semibold">Applications open on<input type="date" className={`${input} mt-1 font-normal`} value={f.opens} onChange={(e) => setF({ ...f, opens: e.target.value })} /></label>
            <label className="text-[14px] font-semibold">…and close on<input type="date" className={`${input} mt-1 font-normal`} value={f.closes} min={f.opens} onChange={(e) => setF({ ...f, closes: e.target.value })} /></label>
            <div className="sm:col-span-2"><button disabled={busy || !f.name.trim() || !f.year.trim() || !f.closes} className={btn}>Create draft</button></div>
          </form>
        </Composer>
      )}

      <section className={card} aria-labelledby="rounds-h">
        <div className={head}><h2 id="rounds-h" className="text-[18px]">Rounds</h2>{rounds && <span className={count}>{rounds.length}</span>}</div>
        {rounds === null ? <p className="p-5 text-ink-3">Loading…</p> : rounds.length === 0 ? <p className="p-5 text-ink-3">{admin ? "No rounds yet. Start one above." : "No round has been shared with you yet."}</p> : (
          <ul className="divide-y divide-line">
            {rounds.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSel(c.id)} aria-pressed={sel === c.id} className={`flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left text-[14.5px] ${sel === c.id ? "bg-soft" : "hover:bg-soft/60"}`}>
                  <b>{c.name}</b><span className="text-ink-3">{c.year}</span>
                  <State tone={CAMPAIGN_TONE[c.status]}>{CAMPAIGN_STATUS[c.status]}</State>
                  <span className="ml-auto text-[13.5px] text-ink-3">{niceDate(c.opens_on)} – {niceDate(c.closes_on)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {round && <Round key={round.id} round={round} admin={admin} meId={meId} busy={busy} setBusy={setBusy} say={say} reload={load} />}
      <p className="text-[13.5px] text-ink-3">Applications that end in &ldquo;not selected&rdquo; or &ldquo;withdrawn&rdquo; are deleted {RETENTION.applicationsMonths} months after the round closes. Reviewers see only the rounds they are assigned to, and only their own scores.</p>
    </div>
  );
}

function Round({ round, admin, meId, busy, setBusy, say, reload }: { round: Campaign; admin: boolean; meId: string; busy: boolean; setBusy: (b: boolean) => void; say: (ok: boolean, t: string) => void; reload: () => Promise<void> }) {
  const [data, setData] = useState<{ apps: Application[]; reviews: Review[]; decisions: Decision[] } | null>(null);
  const [team, setTeam] = useState<{ user_id: string; handle: string }[]>([]); const [reviewer, setReviewer] = useState("");
  const [dates, setDates] = useState({ opens: round.opens_on, closes: round.closes_on });
  const [show, setShow] = useState<"all" | ApplicationStatus>("all");
  const [tab, setTab] = useState<"responses" | "form" | "settings">("responses");
  const [view, setView] = useState<"review" | "summary" | "table" | "email">("review");
  const questions: Question[] = round.questions?.length ? round.questions : DEFAULT_QUESTIONS, teams = round.teams ?? DEFAULT_TEAMS;
  const load = useCallback(async () => { setData(await loadApplications(round.id)); setTeam(await loadReviewers(round.id)); }, [round.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch, then set state after the await
  useEffect(() => { void load(); }, [load]);
  const run = async (p: Promise<{ ok: boolean; error?: string }>, done: string, after?: () => Promise<void>) => {
    setBusy(true); const r = await p; setBusy(false);
    say(r.ok, r.ok ? done : (r as { error: string }).error); if (r.ok) { await load(); await after?.(); }
  };
  const apps = useMemo(() => (data?.apps ?? []).filter((a) => show === "all" || a.status === show), [data, show]);
  const avg = (id: number) => { const s = (data?.reviews ?? []).filter((r) => r.application_id === id).map((r) => r.score); return s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10 : null; };
  const canOpen = round.status === "draft" || round.status === "closed";

  return (
    <section className={card} aria-labelledby="round-h">
      <div className={head}>
        <h2 id="round-h" className="text-[18px]">{round.name}</h2>
        <State tone={CAMPAIGN_TONE[round.status]}>{CAMPAIGN_STATUS[round.status]}</State>
        {admin && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {canOpen && <button disabled={busy} className={btn} onClick={() => void run(setCampaignStatus(round.id, "open"), "Applications are open at /apply.", reload)}>Open applications</button>}
            {round.status === "open" && <button disabled={busy} className={btnSoft} onClick={() => void run(setCampaignStatus(round.id, "closed"), "Applications are closed.", reload)}>Close applications</button>}
            {(round.status === "draft" || round.status === "closed") && <button disabled={busy} className={btnSoft} onClick={() => void run(setCampaignStatus(round.id, "archived"), "Archived.", reload)}>Archive</button>}
          </span>
        )}
      </div>

      {admin && (
        <div role="tablist" onKeyDown={tabKeys} aria-label="This round" className="flex flex-wrap gap-1 border-b border-line px-5 py-2">
          {([["responses", `Responses ${data?.apps.length ?? ""}`], ["form", `Form · ${questions.length} ${questions.length === 1 ? "question" : "questions"}`], ["settings", "Reviewers & dates"]] as const).map(([t, l]) => (
            <button key={t} role="tab" aria-selected={tab === t} tabIndex={tab === t ? 0 : -1} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-[14px] ${tab === t ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{l}</button>
          ))}
        </div>
      )}

      {admin && tab === "form" && <RecruitForm key={round.id} round={round} applied={data?.apps.length ?? 0} busy={busy} run={run} reload={reload} />}

      {admin && tab === "settings" && (
        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <div>
            <h3 className="text-[15px]">Dates</h3>
            <form onSubmit={(e) => { e.preventDefault(); void run(setCampaignDates(round.id, dates.opens, dates.closes), "Dates saved.", reload); }} className="mt-2 flex flex-wrap items-end gap-2">
              <label className="text-[13.5px]">Opens<input type="date" className={`${input} mt-1`} value={dates.opens} onChange={(e) => setDates({ ...dates, opens: e.target.value })} /></label>
              <label className="text-[13.5px]">Closes<input type="date" className={`${input} mt-1`} value={dates.closes} min={dates.opens} onChange={(e) => setDates({ ...dates, closes: e.target.value })} /></label>
              <button disabled={busy} className={btnSoft}>Save</button>
            </form>
            <p className="mt-2 text-[13px] text-ink-3">Applications are accepted only between these dates (India time) while the round is open.</p>
          </div>
          <div>
            <h3 className="text-[15px]">Reviewers</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {team.length === 0 && <li className="text-[14px] text-ink-3">Nobody yet: no one can read the applications except admins.</li>}
              {team.map((t) => <li key={t.user_id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[14px]">@{t.handle}<button disabled={busy} aria-label={`Remove @${t.handle} as a reviewer`} onClick={() => void run(removeReviewer(round.id, t.user_id), `@${t.handle} is no longer a reviewer.`)} className="text-ink-3 hover:text-ink">×</button></li>)}
            </ul>
            <form onSubmit={(e) => { e.preventDefault(); void run(addReviewer(round.id, reviewer), `@${reviewer.replace(/^@/, "")} can now review this round.`, async () => setReviewer("")); }} className="mt-2 flex gap-2">
              <label className="sr-only" htmlFor="reviewer">GitHub username of a reviewer</label>
              <input id="reviewer" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="github-username (core team or admin)" className={input} autoComplete="off" />
              <button disabled={busy || !reviewer.trim()} className={btnSoft}>Add</button>
            </form>
          </div>
        </div>
      )}

      {(!admin || tab === "responses") && (<>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <div role="group" aria-label="Show the responses as" className="flex flex-wrap gap-1">
            {([["review", "Review"], ["summary", "Summary"], ["table", "Table"], ...(admin ? [["email", "Email applicants"]] : [])] as [typeof view, string][]).map(([v, l]) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 text-[13.5px] transition-colors duration-150 ${view === v ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`}>{l}</button>
            ))}
          </div>
          {admin && (data?.apps.length ?? 0) > 0 && <button disabled={busy} onClick={async () => { const err = await downloadResponses(round, questions, data!.reviews, data!.decisions, STATUS); if (err) say(false, err); }} className={`${btnSoft} ml-auto`}><DownloadIcon size={14} aria-hidden />Download CSV</button>}
        </div>
        {data === null ? <p className="p-5 text-ink-3">Loading…</p>
          : view === "summary" ? <Summary questions={questions} teams={teams} apps={data.apps} showTable={() => setView("table")} />
          : view === "table" ? <ResponseTable questions={questions} apps={data.apps} score={avg} status={STATUS} />
          : view === "email" && admin ? <EmailApplicants round={round} apps={data.apps} />
          : (<>
            <div className="space-y-3 px-5 py-4">
              <h3 className="flex items-center gap-2 text-[16px]">Applications <span className={count}>{data.apps.length}</span></h3>
              <Pipeline apps={data.apps} show={show} setShow={setShow} />
            </div>
            {apps.length === 0 ? <p className="px-5 pb-5 text-ink-3">{data.apps.length === 0 ? (admin ? "No applications yet. Share /apply once the round is open." : "No applications to show. You may not be assigned to this round.") : "None at that stage."}</p> : (
              <ul className="divide-y divide-line border-t border-line">
                {apps.map((a) => <AppRow key={a.id} a={a} questions={questions} avg={avg(a.id)} mine={data.reviews.find((r) => r.application_id === a.id && r.reviewer_id === meId)} all={data.reviews.filter((r) => r.application_id === a.id)} decision={data.decisions.find((d) => d.application_id === a.id)} admin={admin} busy={busy} run={run} />)}
              </ul>
            )}
          </>)}
      </>)}
    </section>
  );
}

/** The stages as one path: New → Screening → Interview → Selected → Member, with how many are at each; the side exits
    (waitlisted, not selected, withdrawn) sit after it. Pressing a stage shows only those; pressing it again shows everyone. */
function Pipeline({ apps, show, setShow }: { apps: Application[]; show: "all" | ApplicationStatus; setShow: (s: "all" | ApplicationStatus) => void }) {
  const n = (s: ApplicationStatus) => apps.filter((a) => a.status === s).length;
  const pick = (s: ApplicationStatus) => setShow(show === s ? "all" : s);
  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13.5px] transition-colors duration-150 ${on ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-soft"}`;
  return (
    <div role="group" aria-label="Show applications at a stage" className="flex flex-wrap items-center gap-y-2">
      <button aria-pressed={show === "all"} onClick={() => setShow("all")} className={`${chip(show === "all")} mr-2`}>All <span className="font-mono text-[12px] opacity-75">{apps.length}</span></button>
      {FLOW.map((s, i) => (
        <span key={s} className={`commit flex items-center ${n(s) ? "is-past" : ""} ${show === s ? "is-head" : ""}`}>
          {i > 0 && <span aria-hidden className="h-0.5 w-2.5 rounded bg-ink/25 sm:w-3.5" />}
          <button aria-pressed={show === s} onClick={() => pick(s)} className={chip(show === s)}><span className="commit-node" aria-hidden />{STATUS[s]} <span className="font-mono text-[12px] opacity-75">{n(s)}</span></button>
        </span>
      ))}
      <span aria-hidden className="mx-2 hidden h-5 w-px bg-line sm:block" />
      {ASIDE.filter((s) => n(s) || show === s).map((s) => <button key={s} aria-pressed={show === s} onClick={() => pick(s)} className={chip(show === s)}>{STATUS[s]} <span className="font-mono text-[12px] opacity-75">{n(s)}</span></button>)}
    </div>
  );
}

function AppRow({ a, questions, avg, mine, all, decision, admin, busy, run }: { a: Application; questions: Question[]; avg: number | null; mine?: Review; all: Review[]; decision?: Decision; admin: boolean; busy: boolean; run: (p: Promise<{ ok: boolean; error?: string }>, done: string) => Promise<void> }) {
  const [score, setScore] = useState(String(mine?.score ?? "")); const [notes, setNotes] = useState(mine?.notes ?? ""); const [why, setWhy] = useState(decision?.reason ?? "");
  const open = ["submitted", "screening", "interview"].includes(a.status);
  const next: { to: ApplicationStatus; label: string } | null = a.status === "submitted" ? { to: "screening", label: "Start screening" } : a.status === "screening" ? { to: "interview", label: "Move to interview" } : null;
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-3 text-[14.5px] hover:bg-soft/60">
          <b>{a.name}</b><span className="text-ink-3">@{a.handle}</span>{a.team_pref && <span className="text-[13.5px] text-ink-3">{a.team_pref}</span>}
          <State tone={TONE[a.status]}>{STATUS[a.status]}</State>
          {avg !== null && <span className="font-mono text-[13px] text-ink-2">{admin ? `${avg}/5 from ${all.length}` : `you gave ${mine?.score ?? "–"}/5`}</span>}
          <span className="ml-auto text-[13px] text-ink-3 group-open:hidden">Open</span>
        </summary>
        <div className="space-y-4 px-5 pb-5 text-[14.5px]">
          <p className="text-ink-3">{a.email} · applied {niceDate(a.created_at.slice(0, 10))}</p>
          {questions.map((q) => { const t = answerText(a.answers?.[q.id]); return t ? <div key={q.id}><p className="font-semibold">{q.label}</p><p className="mt-1 whitespace-pre-wrap text-ink-2">{q.type === "link" && /^https?:\/\//.test(t) ? <a href={t} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-2 hover:underline">{t}</a> : t}</p></div> : null; })}
          {Object.keys(a.answers ?? {}).filter((k) => !questions.some((q) => q.id === k)).map((k) => <div key={k}><p className="font-semibold text-ink-3">A question since removed from the form</p><p className="mt-1 whitespace-pre-wrap text-ink-2">{answerText(a.answers[k])}</p></div>)}

          {open && (
            <form onSubmit={(e) => { e.preventDefault(); void run(reviewApplication(a.id, Number(score), notes), "Review saved."); }} className="rounded-lg border border-line p-4">
              <h4 className="text-[15px]">{mine ? "Your review (you can change it)" : "Your review"}</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-[120px_1fr]">
                <label className="text-[13.5px] font-semibold">Score 1–5<select value={score} onChange={(e) => setScore(e.target.value)} className={`${input} mt-1 font-normal`}><option value="">–</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
                <label className="text-[13.5px] font-semibold">Notes <span className="font-normal text-ink-3">(only you and admins see these; no sensitive personal details)</span><textarea value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${input} mt-1 font-normal`} /></label>
              </div>
              <button disabled={busy || !score} className={`${btnSoft} mt-3`}>Save review</button>
            </form>
          )}
          {admin && all.length > 0 && <div><p className="font-semibold">All reviews</p><ul className="mt-1 text-ink-2">{all.map((r) => <li key={r.id}>{r.score}/5{r.notes ? ` · ${r.notes}` : ""}</li>)}</ul></div>}

          <div className="flex flex-wrap items-center gap-2">
            {next && <button disabled={busy} onClick={() => void run(moveApplication(a.id, next.to), `Moved to ${STATUS[next.to].toLowerCase()}.`)} className={btnSoft}>{next.label}</button>}
            {admin && open && <button disabled={busy} onClick={() => void run(moveApplication(a.id, "withdrawn"), "Marked as withdrawn.")} className={btnSoft}>Withdrawn</button>}
          </div>

          {admin && (a.status === "interview" || a.status === "waitlisted") && (
            <div className="rounded-lg border border-line p-4">
              <h4 className="text-[15px]">Decision</h4>
              <label className="mt-2 block text-[13.5px] font-semibold">Reason <span className="font-normal text-ink-3">(kept with the decision)</span><input value={why} maxLength={1000} onChange={(e) => setWhy(e.target.value)} className={`${input} mt-1 font-normal`} /></label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => void run(decideApplication(a.id, "selected", why), "Selected.")} className={btn}>Select</button>
                {a.status === "interview" && <button disabled={busy} onClick={() => void run(decideApplication(a.id, "waitlisted", why), "Waitlisted.")} className={btnSoft}>Waitlist</button>}
                <button disabled={busy} onClick={() => void run(decideApplication(a.id, "rejected", why), "Marked as not selected.")} className={btnSoft}>Not selected</button>
              </div>
            </div>
          )}
          {admin && a.status === "selected" && <button disabled={busy} onClick={() => void run(onboardApplication(a.id), "Added to Members. Give them an appointment under People & roles if they need access.")} className={btn}>Onboard as a member</button>}
          {decision && <p className="text-ink-3">Decision: {STATUS[decision.decision as ApplicationStatus]}{decision.reason ? ` · ${decision.reason}` : ""}</p>}
        </div>
      </details>
    </li>
  );
}
