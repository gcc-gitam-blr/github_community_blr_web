"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeftIcon, ArrowRightIcon, BookmarkIcon, CheckIcon, DownloadIcon, PencilIcon, FlameIcon, HistoryIcon, PeopleIcon, PlayIcon, ScreenFullIcon, TrashIcon, UploadIcon, XIcon } from "@primer/octicons-react";
import { Sticker, type StickerName } from "@/components/ui/Sticker";
import { useWakeLock } from "@/components/epoch/Kiosk";
import { parseQuiz, type Quiz } from "@/lib/quiz/parse";
import { hasRealtime, newCode } from "@/lib/quiz/room";
import { HostGame, SAVE, type Player, type Run, type Saved } from "@/lib/quiz/game";
import { forget, loadRuns, saveRun, toCsv } from "@/lib/quiz/history";
import { deleteSet, loadSets, saveSet, type QuizSet } from "@/lib/quiz/sets";
import { useClientValue } from "@/lib/useClientValue";
import { Glyph, Progress, Rich, TILES, fmt } from "./Bits";

/* /quiz/host — the projector. Pick a quiz (or paste one), show the code, run it, look back on old ones.
   This browser is the game (lib/quiz/game.ts): it's saved after every step, so a refresh carries on. */

type Source = { slug: string; text: string };
const S = (s: string) => s as StickerName;

export function Host({ quizzes }: { quizzes: Source[] }) {
  const [game, setGame] = useState<Saved | null>(null);
  const [viewing, setViewing] = useState<Run | null>(null);
  const [dropped, setDropped] = useState(false);
  const raw = useClientValue(() => { try { return localStorage.getItem(SAVE); } catch { return null; } }, null);
  const resume = useMemo(() => { try { const g = JSON.parse(raw || "null") as Saved | null; return g?.phase && g.phase !== "end" ? g : null; } catch { return null; } }, [raw]);

  const exit = (run?: Run) => { try { localStorage.removeItem(SAVE); } catch { /* fine */ } setGame(null); setDropped(true); if (run) setViewing(run); };
  if (game) return <Stage key={game.code} start={game} onExit={exit} />;
  if (viewing) return <Results run={viewing} onBack={() => setViewing(null)} />;
  return <Setup quizzes={quizzes} resume={dropped ? null : resume} onView={setViewing}
    onStart={(quiz) => setGame({ code: newCode(), quiz, phase: "lobby", index: 0, players: [], kicked: [], started: Date.now() })} onResume={() => resume && setGame(resume)} />;
}

/* ---------------- choosing the questions ---------------- */

function Setup({ quizzes, resume, onStart, onResume, onView }: { quizzes: Source[]; resume: Saved | null; onStart: (q: Quiz) => void; onResume: () => void; onView: (r: Run) => void }) {
  const ready = useMemo(() => quizzes.map((s) => ({ ...s, quiz: parseQuiz(s.text) })).filter((s) => s.quiz.questions.length), [quizzes]);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState<string | null>(null); // null: use the quiz's own heading, or the file's name
  const pasted = useMemo(() => (text.trim() ? parseQuiz(text) : null), [text]);
  const named = pasted && pasted.title !== "Untitled quiz" ? pasted.title : fileName;
  const finalTitle = (title ?? named).trim() || "Untitled quiz";
  const file = useRef<HTMLInputElement>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  useEffect(() => { let on = true; void loadRuns().then((r) => { if (on) setRuns(r); }); return () => { on = false; }; }, []);
  // saved for later: written now, hosted another day
  const [sets, setSets] = useState<QuizSet[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { let on = true; void loadSets().then((r) => { if (on) setSets(r); }); return () => { on = false; }; }, []);
  const mine = useMemo(() => (sets ?? []).map((s) => ({ ...s, quiz: { ...parseQuiz(s.text), title: s.title } })), [sets]);
  const clear = () => { setText(""); setTitle(null); setFileName(""); setEditing(null); };
  const keep = async () => {
    if (!pasted?.questions.length) return;
    const s = await saveSet({ id: editing ?? undefined, title: finalTitle, text });
    setSets((xs) => [s, ...(xs ?? []).filter((x) => x.id !== s.id)]);
    setSaved(`Saved "${s.title}". It's in your list; nobody can join until you host it.`); clear();
  };
  const edit = (s: QuizSet) => { setText(s.text); setTitle(s.title); setEditing(s.id); setSaved(""); box.current?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  const drop = async (s: QuizSet) => { if (!confirm(`Delete "${s.title}"?`)) return; await deleteSet(s.id); setSets((xs) => (xs ?? []).filter((x) => x.id !== s.id)); if (editing === s.id) clear(); };

  const load = async (f?: File) => {
    if (!f) return;
    setFileName(f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")); setTitle(null);
    if (/\.pdf$/i.test(f.name)) return setText("(PDFs can't be read in the browser yet. Open the PDF, select all, copy, and paste it here.)");
    setText(await f.text());
  };

  return (
    <main className="min-h-dvh bg-[#0b0b0f] px-4 pb-20 pt-10 text-white sm:px-6 md:px-10 md:pt-14">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[13px] text-white/50">{"// git quiz --host"}</p>
            <h1 className="mt-3 text-[clamp(38px,6vw,72px)]">Host a quiz.</h1>
          </div>
          <div className="hidden shrink-0 items-end sm:flex" aria-hidden>
            <Sticker name="professor" size={96} tilt={-8} /><Sticker name="jetpack" size={84} tilt={7} className="-ml-4 mb-3" />
          </div>
        </div>
        <p className="mt-3 max-w-[60ch] text-[16px] text-white/65 md:text-[17px]">Pick a quiz, put this screen on the projector, and everyone joins from their phone with the code. {hasRealtime ? "" : <span className="text-[#ffc933]">Demo mode: realtime isn&apos;t connected, so only tabs in this browser can join.</span>}</p>

        {resume && (
          <button onClick={onResume} className="mt-8 flex w-full items-center gap-4 rounded-2xl border border-[#3fc84e]/40 bg-[#3fc84e]/10 p-4 text-left hover:bg-[#3fc84e]/15 sm:p-5">
            <span className="font-mono text-[18px] text-[#3fc84e] sm:text-[22px]">{resume.code}</span>
            <span className="min-w-0 flex-1"><b className="block truncate text-[16px] sm:text-[17px]">Carry on: {resume.quiz.title}</b><span className="text-[14px] text-white/60">{resume.players.length} players · question {resume.index + 1} of {resume.quiz.questions.length}</span></span>
            <ArrowRightIcon size={20} />
          </button>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8">
          <section aria-labelledby="ready-h">
            <h2 id="ready-h" className="font-mono text-[13px] font-normal tracking-normal text-white/50">ready to play</h2>
            <ul className="mt-3 grid gap-3">
              {mine.map((s, n) => (
                <li key={s.id} className="flex items-stretch gap-2">
                  <button onClick={() => onStart(s.quiz)} disabled={!s.quiz.questions.length} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-colors hover:border-white/25 hover:bg-white/[0.07] disabled:opacity-50 sm:gap-4 sm:p-5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#0b0b0f] sm:h-12 sm:w-12" style={{ background: TILES[(n + 1) % 4].color }}><Glyph i={(n + 1) % 4} className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1"><b className="block text-[16px] font-semibold leading-snug sm:text-[18px]">{s.title}</b><span className="font-mono text-[12.5px] text-white/50">{s.quiz.questions.length} questions · saved {when(s.at)}</span></span>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#3fc84e] px-4 py-2 text-[14px] font-semibold text-[#0b0b0f]"><PlayIcon size={14} />Host</span>
                  </button>
                  <span className="flex shrink-0 flex-col gap-2">
                    <button onClick={() => edit(s)} aria-label={`Edit ${s.title}`} title="Edit" className="grid flex-1 place-items-center rounded-xl border border-white/10 px-3 text-white/70 hover:border-white/30 hover:text-white"><PencilIcon size={16} /></button>
                    <button onClick={() => void drop(s)} aria-label={`Delete ${s.title}`} title="Delete" className="grid flex-1 place-items-center rounded-xl border border-white/10 px-3 text-white/70 hover:border-[#ff7b72]/60 hover:text-[#ff7b72]"><TrashIcon size={16} /></button>
                  </span>
                </li>
              ))}
              {ready.map((s, n) => (
                <li key={s.slug}>
                  <button onClick={() => onStart(s.quiz)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-colors hover:border-white/25 hover:bg-white/[0.07] sm:gap-4 sm:p-5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#0b0b0f] sm:h-12 sm:w-12" style={{ background: TILES[n % 4].color }}><Glyph i={n % 4} className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1"><b className="block text-[16px] font-semibold leading-snug sm:text-[18px]">{s.quiz.title}</b><span className="font-mono text-[12.5px] text-white/50">{s.quiz.questions.length} questions</span></span>
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#3fc84e] px-4 py-2 text-[14px] font-semibold text-[#0b0b0f]"><PlayIcon size={14} />Host</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-white/40">Got questions in a PDF or doc? Copy them into the box, or send them in to be added here.</p>
          </section>

          <section aria-labelledby="paste-h" className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="paste-h" className="font-mono text-[13px] font-normal tracking-normal text-white/50">{editing ? "editing a saved quiz" : "or bring your own"}</h2>
              <button onClick={() => file.current?.click()} className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[14px] text-white/80 hover:border-white/35 hover:text-white"><UploadIcon size={14} />Open a file</button>
              <input ref={file} type="file" accept=".txt,.md,.markdown,.pdf,text/plain" hidden onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {saved && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-[#3fc84e]/10 px-3 py-2.5 text-[14px] text-[#9be9a8]"><BookmarkIcon size={16} className="mt-0.5 shrink-0" />{saved}</p>}
            <textarea ref={box} value={text} onChange={(e) => { setText(e.target.value); setSaved(""); }} spellCheck={false} aria-label="Questions"
              placeholder={"Paste your questions here.\n\n1. Which command stages a file?\nA) git push\nB) git add\nAnswer: B\n\n## What does git clone do?\n- [ ] Makes a branch\n- [x] Copies a repository"}
              className="mt-3 h-[260px] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-mono text-[13.5px] leading-relaxed text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none md:h-[300px]" />
            {pasted && (
              <div className="mt-3 rounded-2xl border border-white/10 p-4 text-[14px]" aria-live="polite">
                <label className="block">
                  <span className="font-mono text-[12.5px] text-white/50">quiz title</span>
                  <input value={title ?? named} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Name this quiz"
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-[17px] font-semibold text-white placeholder:font-normal placeholder:text-white/30 focus:border-[#3fc84e] focus:outline-none" />
                </label>
                <p className="mt-3 flex items-center gap-2"><span className="text-[#3fc84e]"><CheckIcon size={16} /></span><b>{pasted.questions.length} question{pasted.questions.length === 1 ? "" : "s"} ready</b></p>
                {pasted.problems.map((p) => <p key={p.line + p.message} className="mt-1.5 flex gap-2 text-[#ffb4a8]"><XIcon size={16} className="mt-0.5 shrink-0" /><span><span className="font-mono text-white/50">line {p.line}</span> {p.message}</span></p>)}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button disabled={!pasted.questions.length} onClick={() => void keep()} className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[#0b0b0f] disabled:opacity-40"><BookmarkIcon size={16} />{editing ? "Save changes" : "Save for later"}</button>
                  <button disabled={!pasted.questions.length} onClick={() => onStart({ title: finalTitle, questions: pasted.questions })} className="flex items-center justify-center gap-2 rounded-full border border-[#3fc84e]/60 px-5 py-3 font-semibold text-[#3fc84e] hover:bg-[#3fc84e]/10 disabled:opacity-40"><PlayIcon size={16} />Host now</button>
                  {editing && <button onClick={clear} className="px-3 py-3 text-[14px] text-white/55 hover:text-white">Cancel</button>}
                </div>
                <p className="mt-2 text-[12.5px] text-white/40">Saving doesn&apos;t open anything. Players can only join once you press Host and show the code.</p>
              </div>
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-white/45">Tick the right answer with <code className="font-mono text-white/70">- [x]</code>, or write <code className="font-mono text-white/70">Answer: B</code> under lettered options. 2–4 options a question; add <code className="font-mono text-white/70">time: 30</code> for more seconds.</p>
          </section>
        </div>

        <section aria-labelledby="past-h" className="mt-14">
          <h2 id="past-h" className="flex items-center gap-2 font-mono text-[13px] font-normal tracking-normal text-white/50"><HistoryIcon size={14} />past quizzes</h2>
          {runs === null ? <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
            : !runs.length ? <p className="mt-3 rounded-2xl border border-dashed border-white/15 p-5 text-[15px] text-white/50">Nothing yet. When a quiz finishes, its results are kept here.</p>
            : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {runs.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => onView(r)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-left hover:border-white/25 hover:bg-white/[0.06]">
                      {r.players[0] ? <Sticker name={S(r.players[0].sticker)} size={44} /> : <span className="h-11 w-11" />}
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15.5px]">{r.title}</b>
                        <span className="block truncate text-[13px] text-white/50">{when(r.at)} · {r.players.length} played{r.players[0] ? ` · won by ${r.players[0].name}` : ""}</span>
                      </span>
                      <ArrowRightIcon size={16} className="shrink-0 text-white/40" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </main>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/* ---------------- looking back ---------------- */

function Results({ run, onBack }: { run: Run; onBack: () => void }) {
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(run)], { type: "text/csv" }));
    a.download = `${run.title.replace(/[^\w]+/g, "-").toLowerCase()}-${run.at.slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <main className="min-h-dvh bg-[#0b0b0f] px-4 pb-20 pt-8 text-white sm:px-6 md:px-10">
      <div className="mx-auto max-w-[900px]">
        <button onClick={onBack} className="flex items-center gap-2 text-[14px] text-white/60 hover:text-white"><ArrowLeftIcon size={16} />All quizzes</button>
        <p className="mt-8 font-mono text-[13px] text-white/50">$ git show {run.code} · {when(run.at)}</p>
        <h1 className="mt-2 text-[clamp(32px,5vw,56px)]">{run.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={download} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#0b0b0f]"><DownloadIcon size={14} />Download results (CSV)</button>
          <button onClick={() => { if (confirm("Remove this quiz from this browser's history?")) { forget(run.id); onBack(); } }} className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[14px] text-white/70 hover:text-white"><TrashIcon size={14} />Remove</button>
        </div>

        <h2 className="mt-10 font-mono text-[13px] font-normal tracking-normal text-white/50">$ git shortlog -sn --points · {run.players.length} played</h2>
        <ol className="mt-3 overflow-hidden rounded-2xl border border-white/10">
          {run.players.map((p, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5 last:border-0">
              <span className={`w-7 font-mono text-[16px] font-bold tabular-nums ${i < 3 ? "text-[#ffc933]" : "text-white/45"}`}>{i + 1}</span>
              <Sticker name={S(p.sticker)} size={34} />
              <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{p.name}</span>
              <span className="hidden font-mono text-[13px] text-white/45 sm:inline">{p.right}/{run.questions.length} right</span>
              <span className="w-20 text-right font-mono text-[16px] font-bold tabular-nums">{fmt(p.score)}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 font-mono text-[13px] font-normal tracking-normal text-white/50">question by question</h2>
        <ol className="mt-3 grid gap-3">
          {run.questions.map((q, i) => {
            const right = q.answered ? Math.round((q.counts[q.answer] / q.answered) * 100) : 0;
            return (
              <li key={i} className="rounded-2xl border border-white/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[13px] text-white/40">{i + 1}</span>
                  <p className="flex-1 text-[16px] font-semibold leading-snug"><Rich text={q.q} /></p>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[13px] font-bold ${right >= 60 ? "bg-[#1a7f37]" : right >= 30 ? "bg-[#9a6700]" : "bg-[#a40e26]"}`}>{right}% right</span>
                </div>
                <ul className="mt-3 grid gap-1.5">
                  {q.options.map((o, k) => (
                    <li key={k} className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-white/[0.04] px-3 py-1.5 text-[14px]">
                      <span className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${q.answered ? (q.counts[k] / q.answered) * 100 : 0}%`, background: TILES[k].color }} aria-hidden />
                      <span className="relative" style={{ color: TILES[k].color }}><Glyph i={k} className="h-3.5 w-3.5" /></span>
                      <span className={`relative flex-1 ${k === q.answer ? "font-semibold text-white" : "text-white/70"}`}><Rich text={o} /></span>
                      {k === q.answer && <span className="relative text-[#4fd1a1]"><CheckIcon size={14} /></span>}
                      <span className="relative w-6 text-right font-mono tabular-nums text-white/70">{q.counts[k]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}

/* ---------------- running it ---------------- */

function Stage({ start, onExit }: { start: Saved; onExit: (run?: Run) => void }) {
  const [game] = useState(() => new HostGame(start));
  const { phase, index, live, deadline, players: list, answered, answeredIds, counts, before: prevOrder } = useSyncExternalStore(game.subscribe, game.get, game.get);
  const { code, quiz } = game;
  const still = useReducedMotion();
  useWakeLock();
  const [now, setNow] = useState(() => Date.now());
  const joinUrl = useClientValue(() => `${window.location.origin}/quiz?code=${code}`, `/quiz?code=${code}`);
  const q = quiz.questions[index];

  useEffect(() => game.connect(), [game]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);
  useEffect(() => { if (phase === "end") void saveRun(game.summary()); }, [phase, game]); // kept for "past quizzes"

  // Space / Enter / → moves on, so the host can drive it from a clicker
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, button")) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); game.next(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [game]);

  const next = () => game.next();
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const sticker = new Map(list.map((p) => [p.id, p.sticker]));

  return (
    <div className="flex min-h-dvh flex-col bg-[#0b0b0f] px-4 py-4 text-white md:h-dvh md:overflow-hidden md:px-[3.5vw] md:py-[3.5vh]">
      <header className="flex items-center gap-3 text-[14px] md:gap-[1.2vw] md:text-[2.2vh]">
        <span className="hidden font-mono text-white/50 sm:inline">git quiz</span>
        <span className="min-w-0 truncate font-semibold">{quiz.title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-white/60"><PeopleIcon size={16} />{list.length}</span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-white/60" title={live ? "Connected" : "Connecting"}><span className={`h-2 w-2 rounded-full ${live ? "bg-[#3fc84e]" : "animate-blink bg-[#ffc933]"}`} aria-hidden />{code}</span>
        <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="hidden rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white md:block" aria-label="Full screen"><ScreenFullIcon size={18} /></button>
        <button onClick={() => { if (phase === "end" || confirm("End this quiz for everyone?")) onExit(); }} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="End quiz"><XIcon size={18} /></button>
      </header>

      {phase !== "lobby" && phase !== "end" && <Progress index={index} total={quiz.questions.length} className="mt-4 text-[12px] md:mt-[2.5vh] md:text-[1.8vh]" />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={phase === "question" || phase === "reveal" ? `q${index}` : phase + index} className="flex min-h-0 flex-1 flex-col"
          initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={still ? undefined : { opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}>

          {phase === "lobby" && (
            <div className="flex min-h-0 flex-1 flex-col pt-6 md:pt-[3vh]">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-[4vw]">
                <div className="min-w-0">
                  <ol className="flex flex-col gap-1 text-[15px] text-white/65 md:text-[2.4vh]">
                    <li><span className="mr-2 font-mono text-white/35">1</span>Open <b className="text-white">{joinUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</b> or scan the code</li>
                    <li><span className="mr-2 font-mono text-white/35">2</span>Type this, pick a name and a character</li>
                  </ol>
                  <p className="mt-4 font-mono text-[15px] text-white/40 md:mt-[2vh] md:text-[2.4vh]">$ git checkout</p>
                  <p className="font-mono text-[64px] font-bold leading-none tracking-[0.06em] text-[#3fc84e] sm:text-[88px] md:text-[14vh]">{code}</p>
                </div>
                <div className="flex shrink-0 flex-row items-center gap-4 md:flex-col md:gap-[2.5vh]">
                  <div className="rounded-2xl bg-white p-3 md:rounded-[2vh] md:p-[1.8vh]"><QRCodeSVG value={joinUrl} size={512} marginSize={0} className="aspect-square h-[132px] w-auto md:h-[30vh]" role="img" aria-label="QR code to join" /></div>
                  <button onClick={next} disabled={!list.length} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#3fc84e] px-6 py-4 text-[18px] font-bold text-[#0b0b0f] disabled:opacity-35 md:w-full md:flex-none md:py-[1.8vh] md:text-[2.8vh]"><PlayIcon size={22} />Start</button>
                </div>
              </div>

              <div className="mt-8 flex min-h-0 flex-1 flex-col md:mt-[3vh]">
                <p className="flex items-baseline gap-3 font-mono text-[14px] text-white/45 md:text-[2vh]">
                  <span className="text-[28px] font-bold text-white md:text-[4.4vh]">{list.length}</span>
                  {list.length === 1 ? "contributor" : "contributors"}{list.length > 0 && <span className="text-white/30">· click a name to remove it</span>}
                </p>
                {!list.length ? (
                  <div className="mt-3 flex flex-1 items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-white/10 py-10 md:mt-[1.5vh]">
                    {(["octocat", "coder", "skate"] as const).map((n, i) => (
                      <span key={n} className="animate-[float-y_3s_ease-in-out_infinite] opacity-40 motion-reduce:animate-none" style={{ animationDelay: `${i * 0.4}s` }}><Sticker name={n} size={72} tilt={[-8, 4, 10][i]} /></span>
                    ))}
                  </div>
                ) : (
                  <ul className="mt-3 flex min-h-0 flex-wrap content-start gap-2.5 overflow-hidden md:mt-[1.5vh] md:gap-[1.2vh]">
                    <AnimatePresence initial={false}>
                      {list.map((p) => (
                        <motion.li key={p.id} layout={!still} initial={still ? false : { opacity: 0, scale: 0.4, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 420, damping: 20 }}>
                          <button onClick={() => game.kick(p.id)} title={`Remove ${p.name}`} className="group flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] py-1.5 pl-1.5 pr-4 text-[16px] font-semibold hover:border-[#ff7b72]/60 md:gap-[0.8vw] md:py-[0.8vh] md:pl-[0.8vh] md:pr-[1.4vw] md:text-[2.6vh]">
                            <Sticker name={S(p.sticker)} size={60} className="h-10 w-10 md:h-[5.5vh] md:w-[5.5vh]" />
                            <span className="group-hover:line-through">{p.name}</span>
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </div>
          )}

          {(phase === "question" || phase === "reveal") && q && (
            <div className="flex min-h-0 flex-1 flex-col pt-5 md:pt-[3vh]">
              <div className="flex items-start gap-3 md:gap-[2vw]">
                <p className="hidden font-mono text-[2.2vh] text-white/45 md:block">{index + 1}/{quiz.questions.length}</p>
                <h2 className="flex-1 text-[24px] font-bold leading-[1.12] md:text-[clamp(28px,5.6vh,72px)]"><Rich text={q.q} /></h2>
                {phase === "question" ? (
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 font-mono text-[24px] font-bold tabular-nums md:h-[11vh] md:w-[11vh] md:border-[0.6vh] md:text-[5vh] ${left <= 5 ? "border-[#ff7b72] text-[#ff7b72]" : "border-[#ffc933] text-white"}`}>{left}</span>
                ) : (
                  <button onClick={next} className="flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[15px] font-bold text-[#0b0b0f] md:px-[2vw] md:py-[1.4vh] md:text-[2.4vh]">{index + 1 < quiz.questions.length ? "Scores" : "Results"}<ArrowRightIcon size={20} /></button>
                )}
              </div>
              {phase === "question" && <>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10 md:mt-[2.5vh] md:h-[0.7vh]"><div className="h-full rounded-full bg-[#ffc933] transition-[width] duration-200 ease-linear" style={{ width: `${Math.max(0, (deadline - now) / (q.time * 10))}%` }} /></div>
                <div className="mt-3 flex items-center gap-2 text-[14px] text-white/60 md:mt-[1.5vh] md:text-[2.2vh]">
                  <span className="flex -space-x-2">
                    <AnimatePresence initial={false}>
                      {answeredIds.slice(-12).map((id) => <motion.span key={id} initial={still ? false : { scale: 0, y: 8 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}><Sticker name={S(sticker.get(id) ?? "octocat")} size={40} className="h-7 w-7 md:h-[4vh] md:w-[4vh]" /></motion.span>)}
                    </AnimatePresence>
                  </span>
                  <span><b className="text-white">{answered}</b> of {list.length} pushed</span>
                </div>
              </>}
              <ul className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:mt-[2.5vh] md:gap-[2vh]">
                {q.options.map((o, i) => {
                  const right = i === q.answer, c = counts[i] ?? 0;
                  return (
                    <li key={i} className={`relative flex min-h-[64px] items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-[#0b0b0f] transition-[opacity,transform] duration-300 md:gap-[1.6vw] md:rounded-[2vh] md:px-[2.2vw] ${phase === "reveal" ? (right ? "scale-[1.01] ring-4 ring-white md:ring-[0.5vh]" : "opacity-30") : ""}`} style={{ background: TILES[i].color }}>
                      {phase === "reveal" && <motion.span className="absolute inset-y-0 left-0 bg-black/10" initial={{ width: 0 }} animate={{ width: `${(c / Math.max(1, answered)) * 100}%` }} transition={{ duration: still ? 0 : 0.8, ease: [0.23, 1, 0.32, 1] }} aria-hidden />}
                      <Glyph i={i} className="relative h-7 w-7 md:h-[5vh] md:w-[5vh]" />
                      <span className="relative flex-1 text-[17px] font-semibold leading-tight md:text-[clamp(18px,3.6vh,48px)]"><Rich text={o} /></span>
                      {phase === "reveal" && <span className="relative flex items-center gap-1 text-[20px] font-bold tabular-nums md:gap-[0.6vw] md:text-[3.6vh]">{right && <CheckIcon size={26} />}{c}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {phase === "board" && <Board list={list} prev={prevOrder} still={!!still} onNext={next} />}
          {phase === "end" && <Podium list={list} title={quiz.title} still={!!still} onNew={() => onExit()} onResults={() => onExit(game.summary())} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* `git shortlog -sn`, but for points: the top five, sliding from last round's order into this one's. */
function Board({ list, prev, still, onNext }: { list: Player[]; prev: string[] | null; still: boolean; onNext: () => void }) {
  const [settled, setSettled] = useState(still || !prev);
  useEffect(() => { const t = setTimeout(() => setSettled(true), 900); return () => clearTimeout(t); }, []);
  const order = settled || !prev ? list : [...list].sort((a, b) => prev.indexOf(a.id) - prev.indexOf(b.id));
  const top = new Set(list.slice(0, 5).map((p) => p.id));
  return (
    <div className="flex min-h-0 flex-1 flex-col pt-6 md:pt-[4vh]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[14px] text-white/50 md:text-[2.6vh]">$ git shortlog -sn --points</p>
        <button onClick={onNext} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[15px] font-bold text-[#0b0b0f] md:px-[2vw] md:py-[1.4vh] md:text-[2.4vh]">Next question<ArrowRightIcon size={20} /></button>
      </div>
      <ol className="mt-5 flex flex-col gap-2.5 md:mt-[3vh] md:gap-[1.4vh]">
        {order.filter((p) => top.has(p.id)).map((p) => {
          const rank = list.indexOf(p) + 1;
          return (
            <motion.li key={p.id} layout={!still} transition={{ type: "spring", stiffness: 300, damping: 32 }} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 md:gap-[1.6vw] md:rounded-[1.6vh] md:px-[2vw] md:py-[1.6vh] ${rank === 1 ? "border-[#ffc933]/40 bg-[#ffc933]/[0.08]" : "border-white/10 bg-white/[0.05]"}`}>
              <span className={`w-7 font-mono text-[20px] font-bold tabular-nums md:w-[4vw] md:text-[4vh] ${rank <= 3 ? "text-[#ffc933]" : "text-white/50"}`}>{rank}</span>
              <Sticker name={S(p.sticker)} size={60} className="h-10 w-10 md:h-[6vh] md:w-[6vh]" />
              <span className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-[-0.02em] md:text-[4.4vh]">{p.name}</span>
              {p.streak >= 2 && <span className="hidden items-center gap-1 text-[2.6vh] text-[#ffa657] sm:flex"><FlameIcon size={22} />{p.streak}</span>}
              {p.gained > 0 && <span className="rounded-full bg-[#1a7f37] px-2 py-0.5 font-mono text-[13px] tabular-nums md:px-[1vw] md:py-[0.4vh] md:text-[2.4vh]">+{p.gained}</span>}
              <span className="w-16 text-right font-mono text-[18px] font-bold tabular-nums md:w-[12vw] md:text-[4.4vh]">{fmt(p.score)}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/* The release: top three on a podium, each sticker dropping onto its step. */
function Podium({ list, title, still, onNew, onResults }: { list: Player[]; title: string; still: boolean; onNew: () => void; onResults: () => void }) {
  const steps = [list[1], list[0], list[2]];
  const height = ["h-[90px] md:h-[20vh]", "h-[130px] md:h-[28vh]", "h-[64px] md:h-[14vh]"], place = [2, 1, 3];
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center pt-6 md:pt-[3vh]">
      <p className="max-w-full truncate font-mono text-[13px] text-white/50 md:text-[2.4vh]">$ git tag v1.0.0 -m &quot;{title}&quot;</p>
      <h2 className="mt-1 text-[44px] md:mt-[0.5vh] md:text-[6vh]">Released.</h2>
      <div className="mt-auto flex w-full max-w-[1100px] items-end justify-center gap-2 pt-8 md:gap-[1.5vw]">
        {steps.map((p, i) => p && (
          <div key={p.id} className="flex w-[32%] flex-col items-center md:w-[22vw]">
            <motion.div initial={still ? false : { y: -260, opacity: 0, rotate: -12 }} animate={{ y: 0, opacity: 1, rotate: [-6, 4, -2][i] }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: still ? 0 : [1.1, 1.8, 0.4][i] }}>
              <Sticker name={S(p.sticker)} size={240} className="h-[72px] w-[72px] md:h-[13vh] md:w-[13vh]" />
            </motion.div>
            <p className="mt-2 max-w-full truncate text-[16px] font-bold md:mt-[1.5vh] md:text-[3.6vh]">{p.name}</p>
            <p className="font-mono text-[12px] text-white/60 md:text-[2.4vh]">{fmt(p.score)} pts</p>
            <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl pt-2 font-mono text-[32px] font-bold text-[#0b0b0f] md:mt-[1.5vh] md:rounded-t-[1.6vh] md:pt-[2vh] md:text-[7vh] ${height[i]}`} style={{ background: [TILES[1].color, "#ffc933", TILES[0].color][i] }}>{place[i]}</div>
          </div>
        ))}
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 md:pt-[2vh]">
        <p className="text-[14px] text-white/50 md:text-[2.2vh]">{list.length} played · everyone sees their place on their phone</p>
        <div className="flex gap-2">
          <button onClick={onResults} className="rounded-full border border-white/20 px-4 py-2 text-[15px] font-semibold md:px-[2vw] md:py-[1.2vh] md:text-[2.2vh]">Full results</button>
          <button onClick={onNew} className="rounded-full bg-white px-4 py-2 text-[15px] font-bold text-[#0b0b0f] md:px-[2vw] md:py-[1.2vh] md:text-[2.2vh]">New quiz</button>
        </div>
      </div>
    </div>
  );
}
