"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon, CheckIcon, FlameIcon, PeopleIcon, PlayIcon, ScreenFullIcon, UploadIcon, XIcon } from "@primer/octicons-react";
import { Sticker } from "@/components/ui/Sticker";
import { useWakeLock } from "@/components/epoch/Kiosk";
import { parseQuiz, type Quiz } from "@/lib/quiz/parse";
import { hasRealtime, newCode, stickerFor } from "@/lib/quiz/room";
import { HostGame, SAVE, type Player, type Saved } from "@/lib/quiz/game";
import { useClientValue } from "@/lib/useClientValue";
import { Glyph, Progress, Rich, TILES, fmt } from "./Bits";

/* /quiz/host — the projector. Pick a quiz (or paste one), show the code, run it.
   This browser is the game (lib/quiz/game.ts): it's saved after every step, so a refresh carries on. */

type Source = { slug: string; text: string };

export function Host({ quizzes }: { quizzes: Source[] }) {
  const [game, setGame] = useState<Saved | null>(null);
  const [dropped, setDropped] = useState(false);
  const raw = useClientValue(() => { try { return localStorage.getItem(SAVE); } catch { return null; } }, null);
  const resume = useMemo(() => { try { const g = JSON.parse(raw || "null") as Saved | null; return g?.phase && g.phase !== "end" ? g : null; } catch { return null; } }, [raw]);

  const exit = () => { try { localStorage.removeItem(SAVE); } catch { /* fine */ } setGame(null); setDropped(true); };
  if (game) return <Stage key={game.code} start={game} onExit={exit} />;
  return <Setup quizzes={quizzes} resume={dropped ? null : resume} onStart={(quiz) => setGame({ code: newCode(), quiz, phase: "lobby", index: 0, players: [], kicked: [] })} onResume={() => resume && setGame(resume)} />;
}

/* ---------------- choosing the questions ---------------- */

function Setup({ quizzes, resume, onStart, onResume }: { quizzes: Source[]; resume: Saved | null; onStart: (q: Quiz) => void; onResume: () => void }) {
  const ready = useMemo(() => quizzes.map((s) => ({ ...s, quiz: parseQuiz(s.text) })).filter((s) => s.quiz.questions.length), [quizzes]);
  const [text, setText] = useState("");
  const pasted = useMemo(() => (text.trim() ? parseQuiz(text) : null), [text]);
  const file = useRef<HTMLInputElement>(null);

  const load = async (f?: File) => {
    if (!f) return;
    if (/\.pdf$/i.test(f.name)) return setText("# " + f.name.replace(/\.pdf$/i, "") + "\n\n(PDFs can't be read in the browser yet — open it, copy the questions and paste them here.)");
    setText(await f.text());
  };

  return (
    <main className="min-h-dvh bg-[#0b0b0f] px-5 pb-20 pt-12 text-white md:px-10">
      <div className="mx-auto max-w-[1100px]">
        <p className="font-mono text-[13px] text-white/50">{"// git quiz --host"}</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)]">Host a quiz.</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-white/65">Pick a quiz, put this screen on the projector, and everyone joins from their phone with the code. {hasRealtime ? "" : <span className="text-[#ffc933]">Demo mode: realtime isn&apos;t connected, so only tabs in this browser can join.</span>}</p>

        {resume && (
          <button onClick={onResume} className="mt-8 flex w-full items-center gap-4 rounded-2xl border border-[#3fc84e]/40 bg-[#3fc84e]/10 p-5 text-left hover:bg-[#3fc84e]/15">
            <span className="font-mono text-[22px] text-[#3fc84e]">{resume.code}</span>
            <span className="flex-1"><b className="block text-[17px]">Carry on: {resume.quiz.title}</b><span className="text-[14px] text-white/60">{resume.players.length} players · question {resume.index + 1} of {resume.quiz.questions.length}</span></span>
            <ArrowRightIcon size={20} />
          </button>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section aria-labelledby="ready-h">
            <h2 id="ready-h" className="font-mono text-[13px] font-normal tracking-normal text-white/50">ready to play</h2>
            <ul className="mt-3 grid gap-3">
              {ready.map((s, n) => (
                <li key={s.slug}>
                  <button onClick={() => onStart(s.quiz)} className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.07]">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[#0b0b0f]" style={{ background: TILES[n % 4].color }}><Glyph i={n % 4} className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1"><b className="block truncate text-[18px] font-semibold">{s.quiz.title}</b><span className="font-mono text-[13px] text-white/50">{s.quiz.questions.length} questions · content/quizzes/{s.slug}.md</span></span>
                    <span className="flex items-center gap-1.5 rounded-full bg-[#3fc84e] px-4 py-2 text-[14px] font-semibold text-[#0b0b0f]"><PlayIcon size={14} />Host</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="paste-h">
            <div className="flex items-baseline justify-between">
              <h2 id="paste-h" className="font-mono text-[13px] font-normal tracking-normal text-white/50">or paste your own</h2>
              <button onClick={() => file.current?.click()} className="flex items-center gap-1.5 text-[14px] text-white/70 hover:text-white"><UploadIcon size={14} />Open a .txt or .md</button>
              <input ref={file} type="file" accept=".txt,.md,.markdown,.pdf,text/plain" hidden onChange={(e) => void load(e.target.files?.[0])} />
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Questions"
              placeholder={"# My quiz\n\n## What does git clone do?\n- [ ] Makes a branch\n- [x] Copies a repository\n\n2. Which command stages a file?\nA) git push\nB) git add\nAnswer: B"}
              className="mt-3 h-[300px] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] p-4 font-mono text-[14px] leading-relaxed text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none" />
            {pasted && (
              <div className="mt-3 rounded-2xl border border-white/10 p-4 text-[14px]" aria-live="polite">
                <p className="flex items-center gap-2"><span className="text-[#3fc84e]"><CheckIcon size={16} /></span><b>{pasted.questions.length} question{pasted.questions.length === 1 ? "" : "s"}</b><span className="text-white/50">· {pasted.title}</span></p>
                {pasted.problems.map((p) => <p key={p.line + p.message} className="mt-1.5 flex gap-2 text-[#ffb4a8]"><XIcon size={16} className="mt-0.5 shrink-0" /><span><span className="font-mono text-white/50">line {p.line}</span> {p.message}</span></p>)}
                <button disabled={!pasted.questions.length} onClick={() => onStart(pasted)} className="mt-4 flex items-center gap-2 rounded-full bg-[#3fc84e] px-5 py-2.5 font-semibold text-[#0b0b0f] disabled:opacity-40"><PlayIcon size={16} />Host these {pasted.questions.length}</button>
              </div>
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-white/45">Tick the right answer with <code className="font-mono text-white/70">- [x]</code>, or write <code className="font-mono text-white/70">Answer: B</code> under lettered options. 2–4 options a question; add <code className="font-mono text-white/70">time: 30</code> for more seconds.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

/* ---------------- running it ---------------- */

function Stage({ start, onExit }: { start: Saved; onExit: () => void }) {
  const [game] = useState(() => new HostGame(start));
  const { phase, index, live, deadline, players: list, answered, counts, before: prevOrder } = useSyncExternalStore(game.subscribe, game.get, game.get);
  const { code, quiz } = game;
  const still = useReducedMotion();
  useWakeLock();
  const [now, setNow] = useState(() => Date.now());
  const joinUrl = useClientValue(() => `${window.location.origin}/quiz?code=${code}`, `/quiz?code=${code}`);
  const q = quiz.questions[index];

  useEffect(() => game.connect(), [game]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t); }, []);

  // Space / Enter / → moves on, so the host can drive it from a clicker
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, button")) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); game.next(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [game]);

  const next = () => game.next();
  const kick = (id: string) => game.kick(id);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0b0b0f] px-[3.5vw] py-[3.5vh] text-white">
      <header className="flex items-center gap-[1.2vw] text-[2.2vh]">
        <span className="font-mono text-white/50">git quiz</span>
        <span className="truncate font-semibold">{quiz.title}</span>
        <span className="ml-auto flex items-center gap-[0.5vw] text-white/60"><PeopleIcon size={18} />{list.length}</span>
        <span className="flex items-center gap-[0.5vw] font-mono text-white/60"><span className={`h-[1vh] w-[1vh] rounded-full ${live ? "bg-[#3fc84e]" : "bg-[#ffc933]"}`} aria-hidden />{code}</span>
        <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="rounded-full p-[0.8vh] text-white/60 hover:bg-white/10 hover:text-white" aria-label="Full screen"><ScreenFullIcon size={18} /></button>
        <button onClick={() => { if (confirm("End this quiz for everyone?")) onExit(); }} className="rounded-full p-[0.8vh] text-white/60 hover:bg-white/10 hover:text-white" aria-label="End quiz"><XIcon size={18} /></button>
      </header>

      {phase !== "lobby" && phase !== "end" && <Progress index={index} total={quiz.questions.length} className="mt-[2.5vh] text-[1.8vh]" />}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={phase === "question" || phase === "reveal" ? `q${index}` : phase + index} className="flex min-h-0 flex-1 flex-col"
          initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={still ? undefined : { opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}>

          {phase === "lobby" && (
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-[4vw] pt-[4vh]">
              <div className="flex min-h-0 flex-col">
                <p className="text-[2.6vh] text-white/60">Join on your phone at <b className="text-white">{joinUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</b></p>
                <p className="mt-[1.5vh] font-mono text-[2.4vh] text-white/40">$ git checkout</p>
                <p className="font-mono text-[15vh] font-bold leading-none tracking-[0.08em] text-[#3fc84e]">{code}</p>
                <div className="mt-[4vh] flex min-h-0 flex-1 flex-col">
                  <p className="font-mono text-[2vh] text-white/45">{list.length ? `${list.length} contributor${list.length === 1 ? "" : "s"} · click a name to remove it` : "waiting for the first contributor…"}</p>
                  <ul className="mt-[1.5vh] flex min-h-0 flex-wrap content-start gap-[1vh] overflow-hidden">
                    <AnimatePresence initial={false}>
                      {list.map((p) => (
                        <motion.li key={p.id} layout={!still} initial={still ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}>
                          <button onClick={() => kick(p.id)} title="Remove" className="flex items-center gap-[0.6vw] rounded-full border border-white/10 bg-white/[0.06] py-[0.6vh] pl-[0.6vh] pr-[1.2vw] text-[2.4vh] font-medium hover:border-[#ff7b72]/60 hover:line-through">
                            <Sticker name={stickerFor(p.id)} size={34} className="h-[3.6vh] w-[3.6vh]" />{p.name}
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              </div>
              <div className="flex flex-col items-center gap-[3vh]">
                <div className="rounded-[2vh] bg-white p-[2vh]"><QRCodeSVG value={joinUrl} size={512} marginSize={0} className="aspect-square h-[34vh] w-auto" role="img" aria-label="QR code to join" /></div>
                <button onClick={next} disabled={!list.length} className="flex items-center gap-[0.8vw] rounded-full bg-[#3fc84e] px-[3vw] py-[1.8vh] text-[2.8vh] font-bold text-[#0b0b0f] disabled:opacity-35"><PlayIcon size={22} />Start</button>
              </div>
            </div>
          )}

          {(phase === "question" || phase === "reveal") && q && (
            <div className="flex min-h-0 flex-1 flex-col pt-[3vh]">
              <div className="flex items-start gap-[2vw]">
                <p className="font-mono text-[2.2vh] text-white/45">{index + 1}/{quiz.questions.length}</p>
                <h2 className="flex-1 text-[clamp(28px,5.6vh,72px)] font-bold leading-[1.08]"><Rich text={q.q} /></h2>
                {phase === "question" ? (
                  <div className="flex shrink-0 flex-col items-center">
                    <span className={`grid h-[11vh] w-[11vh] place-items-center rounded-full border-[0.6vh] font-mono text-[5vh] font-bold tabular-nums ${left <= 5 ? "border-[#ff7b72] text-[#ff7b72]" : "border-[#ffc933] text-white"}`}>{left}</span>
                    <span className="mt-[1vh] text-[2vh] text-white/60">{answered}/{list.length} answered</span>
                  </div>
                ) : (
                  <button onClick={next} className="flex shrink-0 items-center gap-[0.6vw] rounded-full bg-white px-[2vw] py-[1.4vh] text-[2.4vh] font-bold text-[#0b0b0f]">{index + 1 < quiz.questions.length ? "Scores" : "Results"}<ArrowRightIcon size={20} /></button>
                )}
              </div>
              {phase === "question" && <div className="mt-[2.5vh] h-[0.7vh] overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ffc933] transition-[width] duration-200 ease-linear" style={{ width: `${Math.max(0, (deadline - now) / (q.time * 10))}%` }} /></div>}
              <ul className="mt-[3vh] grid min-h-0 flex-1 grid-cols-2 gap-[2vh]">
                {q.options.map((o, i) => {
                  const right = i === q.answer, total = Math.max(1, answered), c = counts[i] ?? 0;
                  return (
                    <li key={i} className={`relative flex items-center gap-[1.6vw] overflow-hidden rounded-[2vh] px-[2.2vw] text-[#0b0b0f] transition-opacity duration-300 ${phase === "reveal" && !right ? "opacity-30" : ""}`} style={{ background: TILES[i].color }}>
                      {phase === "reveal" && <motion.span className="absolute inset-y-0 left-0 bg-black/10" initial={{ width: 0 }} animate={{ width: `${(c / total) * 100}%` }} transition={{ duration: still ? 0 : 0.8, ease: [0.23, 1, 0.32, 1] }} aria-hidden />}
                      <Glyph i={i} className="relative h-[5vh] w-[5vh]" />
                      <span className="relative flex-1 text-[clamp(18px,3.6vh,48px)] font-semibold leading-tight"><Rich text={o} /></span>
                      {phase === "reveal" && <span className="relative flex items-center gap-[0.6vw] text-[3.6vh] font-bold tabular-nums">{right && <CheckIcon size={30} />}{c}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {phase === "board" && <Board list={list} prev={prevOrder} still={!!still} onNext={next} />}
          {phase === "end" && <Podium list={list} title={quiz.title} onExit={onExit} still={!!still} />}
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
    <div className="flex min-h-0 flex-1 flex-col pt-[4vh]">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[2.6vh] text-white/50">$ git shortlog -sn --points</p>
        <button onClick={onNext} className="flex items-center gap-[0.6vw] rounded-full bg-white px-[2vw] py-[1.4vh] text-[2.4vh] font-bold text-[#0b0b0f]">Next question<ArrowRightIcon size={20} /></button>
      </div>
      <ol className="mt-[3vh] flex flex-col gap-[1.4vh]">
        {order.filter((p) => top.has(p.id)).map((p) => {
          const rank = list.indexOf(p) + 1;
          return (
            <motion.li key={p.id} layout={!still} transition={{ type: "spring", stiffness: 300, damping: 32 }} className="flex items-center gap-[1.6vw] rounded-[1.6vh] border border-white/10 bg-white/[0.05] px-[2vw] py-[1.6vh]">
              <span className={`w-[4vw] font-mono text-[4vh] font-bold tabular-nums ${rank <= 3 ? "text-[#ffc933]" : "text-white/50"}`}>{rank}</span>
              <Sticker name={stickerFor(p.id)} size={60} className="h-[6vh] w-[6vh]" />
              <span className="min-w-0 flex-1 truncate text-[4.4vh] font-semibold tracking-[-0.02em]">{p.name}</span>
              {p.streak >= 2 && <span className="flex items-center gap-[0.3vw] text-[2.6vh] text-[#ffa657]"><FlameIcon size={22} />{p.streak}</span>}
              {p.gained > 0 && <span className="rounded-full bg-[#1a7f37] px-[1vw] py-[0.4vh] font-mono text-[2.4vh] tabular-nums">+{p.gained}</span>}
              <span className="w-[12vw] text-right font-mono text-[4.4vh] font-bold tabular-nums">{fmt(p.score)}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/* The release: top three on a podium, each sticker dropping onto its step. */
function Podium({ list, title, onExit, still }: { list: Player[]; title: string; onExit: () => void; still: boolean }) {
  const steps = [list[1], list[0], list[2]];
  const height = ["h-[20vh]", "h-[28vh]", "h-[14vh]"], place = [2, 1, 3];
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center pt-[3vh]">
      <p className="font-mono text-[2.4vh] text-white/50">$ git tag v1.0.0 -m &quot;{title}&quot;</p>
      <h2 className="mt-[0.5vh] text-[6vh]">Released.</h2>
      <div className="mt-auto flex w-full max-w-[1100px] items-end justify-center gap-[1.5vw]">
        {steps.map((p, i) => p && (
          <div key={p.id} className="flex w-[22vw] flex-col items-center">
            <motion.div initial={still ? false : { y: -260, opacity: 0, rotate: -12 }} animate={{ y: 0, opacity: 1, rotate: [-6, 4, -2][i] }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: still ? 0 : [1.1, 1.8, 0.4][i] }}>
              <Sticker name={stickerFor(p.id)} size={240} className="h-[13vh] w-[13vh]" />
            </motion.div>
            <p className="mt-[1.5vh] max-w-full truncate text-[3.6vh] font-bold">{p.name}</p>
            <p className="font-mono text-[2.4vh] text-white/60">{fmt(p.score)} pts</p>
            <div className={`mt-[1.5vh] flex w-full items-start justify-center rounded-t-[1.6vh] pt-[2vh] font-mono text-[7vh] font-bold text-[#0b0b0f] ${height[i]}`} style={{ background: [TILES[1].color, "#ffc933", TILES[0].color][i] }}>{place[i]}</div>
          </div>
        ))}
      </div>
      <div className="flex w-full items-center justify-between border-t border-white/10 pt-[2vh]">
        <p className="text-[2.2vh] text-white/50">{list.length} played · everyone sees their own place on their phone</p>
        <button onClick={onExit} className="rounded-full bg-white px-[2vw] py-[1.2vh] text-[2.2vh] font-bold text-[#0b0b0f]">New quiz</button>
      </div>
    </div>
  );
}
