"use client";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ClockIcon, CopyIcon, DownloadIcon, PlayIcon, PlusIcon, ZapIcon } from "@primer/octicons-react";
import { loadRuns, toCsv } from "@/lib/quiz/history";
import { loadSets, type QuizSet } from "@/lib/quiz/sets";
import { parseQuiz } from "@/lib/quiz/parse";
import type { Run } from "@/lib/quiz/game";
import { btn, btnSoft, card, count, head, input } from "./kit";

/* The room tools, from the admin: the exam timer and the live quiz. Both run on the projector in their own tab
   (/timer, /quiz/host); this is where you set them up, pick a quiz, find old results and the players' link. */
export type QuizFile = { slug: string; title: string; questions: number };
const PRESETS = [10, 15, 20, 30, 45, 60, 90, 120]; // the same as the timer page
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Timer() {
  const [title, setTitle] = useState(""), [note, setNote] = useState(""), [min, setMin] = useState(60);
  const href = `/timer?${new URLSearchParams({ min: String(min), ...(title.trim() ? { title: title.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}) })}`;
  return (
    <section className={card} aria-labelledby="timer-h">
      <div className={head}><ClockIcon size={18} aria-hidden /><h2 id="timer-h" className="text-[18px]">Exam timer</h2><span className="text-[13.5px] text-ink-3">A countdown for the projector: it survives a reload and warns the room at 10, 5 and 1 minute.</span></div>
      <div className="space-y-4 p-5">
        <label className="block text-[14px] font-semibold">What&apos;s it for <span className="font-normal text-ink-3">(shown big on the screen)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Git fundamentals: written test" className={`${input} mt-1 font-normal`} />
        </label>
        <fieldset>
          <legend className="mb-2 text-[14px] font-semibold">How long</legend>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => <button key={p} type="button" aria-pressed={min === p} onClick={() => setMin(p)} className={`rounded-full px-3.5 py-1.5 text-[14px] transition-colors duration-150 ${min === p ? "bg-ink font-semibold text-white" : "border border-line hover:border-ink/40"}`}>{p < 60 ? `${p} min` : `${Math.floor(p / 60)} h${p % 60 ? ` ${p % 60}` : ""}`}</button>)}
            <label className="flex items-center gap-2 text-[14px] text-ink-2">or <input type="number" min={1} max={600} value={min} onChange={(e) => setMin(Math.max(1, Math.min(600, Number(e.target.value) || 1)))} className={`${input} !w-24 !py-1.5`} aria-label="Minutes" /> minutes</label>
          </div>
        </fieldset>
        <label className="block text-[14px] font-semibold">A line for the room <span className="font-normal text-ink-3">(optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder="Phones away. Write your roll number on every page." className={`${input} mt-1 font-normal`} />
        </label>
        <a href={href} target="_blank" rel="noopener" className={btn}><PlayIcon size={16} aria-hidden />Open it on the projector</a>
        <p className="text-[13.5px] text-ink-3">It opens ready to go: press <b>Start</b> when the room is ready. Full screen with the button in the corner.</p>
      </div>
    </section>
  );
}

function Quizzes({ files }: { files: QuizFile[] }) {
  const [sets, setSets] = useState<QuizSet[] | null>(null), [runs, setRuns] = useState<Run[] | null>(null), [copied, setCopied] = useState(false);
  useEffect(() => { let on = true; void loadSets().then((s) => on && setSets(s)); void loadRuns().then((r) => on && setRuns(r)); return () => { on = false; }; }, []);
  const saved = useMemo(() => (sets ?? []).map((s) => ({ id: s.id, title: s.title, questions: parseQuiz(s.text).questions.length, at: s.at })), [sets]);
  const join = typeof window === "undefined" ? "/quiz" : `${window.location.origin}/quiz`;
  const csv = (r: Run) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toCsv(r)], { type: "text/csv" })); a.download = `${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-results.csv`; a.click(); URL.revokeObjectURL(a.href); };
  const row = "flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3 text-[14.5px]";
  return (
    <section className={card} aria-labelledby="quiz-h">
      <div className={head}><ZapIcon size={18} aria-hidden /><h2 id="quiz-h" className="text-[18px]">Live quiz</h2><span className="text-[13.5px] text-ink-3">Hosted on the projector; players answer on their phones with a room code.</span>
        <a href="/quiz/host" target="_blank" rel="noopener" className={`${btnSoft} ml-auto`}><PlusIcon size={14} aria-hidden />Write or paste a new one</a></div>
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 border-line md:border-r">
          <h3 className="border-b border-line bg-soft px-5 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.08em] text-ink-3">Ready to host</h3>
          <ul className="divide-y divide-line">
            {files.map((q) => <li key={q.slug} className={row}><b className="min-w-0 flex-1">{q.title}</b><span className={count}>{q.questions} {q.questions === 1 ? "question" : "questions"}</span><a href={`/quiz/host?quiz=${encodeURIComponent(q.slug)}`} target="_blank" rel="noopener" className={btnSoft}><PlayIcon size={14} aria-hidden />Host</a></li>)}
            {saved.map((q) => <li key={q.id} className={row}><b className="min-w-0 flex-1">{q.title}</b><span className="text-[13px] text-ink-3">saved {when(q.at)}</span><span className={count}>{q.questions} {q.questions === 1 ? "question" : "questions"}</span><a href={`/quiz/host?set=${encodeURIComponent(q.id)}`} target="_blank" rel="noopener" className={btnSoft}><PlayIcon size={14} aria-hidden />Host</a></li>)}
            {sets === null && <li className="h-12" aria-busy="true" />}
          </ul>
        </div>
        <div className="flex flex-col items-center gap-2 p-5 text-center">
          <QRCodeSVG value={join} size={132} marginSize={1} aria-label="QR code for the players' page" />
          <p className="text-[13px] text-ink-2">Players open <b className="font-mono">/quiz</b> and type the room code shown on the projector.</p>
          <button onClick={async () => { try { await navigator.clipboard.writeText(join); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* the link is shown */ } }} className={btnSoft}><CopyIcon size={14} aria-hidden />{copied ? "Copied" : "Copy the link"}</button>
        </div>
      </div>
      <h3 className="border-y border-line bg-soft px-5 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.08em] text-ink-3">Past results</h3>
      {runs === null ? <div className="h-12" aria-busy="true" /> : runs.length === 0 ? <p className="px-5 py-4 text-[14.5px] text-ink-3">No quiz has been hosted yet. Results appear here after each one, with the winner and a CSV.</p> : (
        <ul className="divide-y divide-line">
          {runs.slice(0, 6).map((r) => {
            const top = [...r.players].sort((a, b) => b.score - a.score)[0];
            return <li key={r.id} className={row}><b className="min-w-0 flex-1">{r.title}</b><span className="text-[13px] text-ink-3">{when(r.at)} · {r.players.length} {r.players.length === 1 ? "player" : "players"}{top ? ` · won by ${top.name}` : ""}</span><button onClick={() => csv(r)} className={btnSoft}><DownloadIcon size={14} aria-hidden />CSV</button></li>;
          })}
        </ul>
      )}
      <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">Host and Open both use a new tab, so this page stays where you left it. Only organisers can host.</p>
    </section>
  );
}

export function LiveTools({ quizzes }: { quizzes: QuizFile[] }) {
  return <div className="space-y-4"><Timer /><Quizzes files={quizzes} /></div>;
}
