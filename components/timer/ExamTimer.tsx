"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellIcon, BellSlashIcon, ClockIcon, PlayIcon, PlusIcon, ScreenFullIcon, XIcon } from "@primer/octicons-react";
import { Sticker } from "@/components/ui/Sticker";
import { useWakeLock } from "@/components/epoch/Kiosk";
import { useConfirm } from "@/components/ui/Confirm";
import { useClientValue } from "@/lib/useClientValue";

/* /timer — a countdown for a pen-and-paper test, made for the projector.
   It counts to a fixed end time, so a refresh, a sleeping laptop or a closed tab doesn't lose a second.
   It warns the room at 10, 5 and 1 minute (a banner and a soft chime), and ends on "Pens down." */

type Run = { title: string; note: string; total: number; endAt: number | null; left: number | null; chime: boolean };
const KEY = "timer:run", MIN = 60_000;
const PRESETS = [10, 15, 20, 30, 45, 60, 90, 120];
const WARN = [10 * MIN, 5 * MIN, MIN];

const read = (raw: string | null): Run | null => { try { const r = JSON.parse(raw || "null") as Run | null; return r && typeof r.total === "number" ? r : null; } catch { return null; } };
const write = (r: Run | null) => { try { if (r) localStorage.setItem(KEY, JSON.stringify(r)); else localStorage.removeItem(KEY); } catch { /* it still runs, it just won't survive a refresh */ } };
const leftOf = (r: Run, now: number) => Math.max(0, r.endAt != null ? r.endAt - now : r.left ?? r.total);
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
};
const at = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const mins = (ms: number) => { const m = Math.round(ms / MIN); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`; };

/** A soft two-note chime. Browsers only allow sound after a click, so it's unlocked when the timer starts. */
let audio: AudioContext | null = null;
const unlock = () => { try { audio ??= new AudioContext(); void audio.resume(); } catch { /* no sound, still a banner */ } };
const chime = (times = 1) => {
  if (!audio) return;
  for (let k = 0; k < times; k++) [660, 880].forEach((f, i) => {
    const o = audio!.createOscillator(), g = audio!.createGain(), t = audio!.currentTime + k * 0.7 + i * 0.18;
    o.type = "sine"; o.frequency.value = f; o.connect(g).connect(audio!.destination);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.start(t); o.stop(t + 0.65);
  });
};

export function ExamTimer() {
  const saved = useClientValue(() => { try { return localStorage.getItem(KEY); } catch { return null; } }, null);
  const [mine, setMine] = useState<Run | null | undefined>(undefined); // undefined: whatever this browser had
  const run = mine !== undefined ? mine : read(saved);
  const set = (r: Run | null) => { write(r); setMine(r); };
  return run ? <Running run={run} set={set} /> : <Setup onStart={(r) => { unlock(); set(r); }} />;
}

/* ---------------- setting it up ---------------- */

function Setup({ onStart }: { onStart: (r: Run) => void }) {
  const [title, setTitle] = useState(""), [note, setNote] = useState("");
  const [preset, setPreset] = useState<number | null>(60);
  const [h, setH] = useState(""), [m, setM] = useState("");
  const [sound, setSound] = useState(true);
  const custom = (Number(h) || 0) * 60 + (Number(m) || 0);
  const total = (preset ?? custom) * MIN;

  return (
    <main className="min-h-dvh bg-[#0b0b0f] px-4 pb-20 pt-10 text-white sm:px-6 md:px-10 md:pt-14">
      <div className="mx-auto max-w-[760px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[13px] text-white/50">{"// git timer"}</p>
            <h1 className="mt-3 text-[clamp(38px,6vw,68px)]">Exam timer.</h1>
          </div>
          <Sticker name="professor" size={100} tilt={6} className="hidden sm:block" />
        </div>
        <p className="mt-3 max-w-[56ch] text-[16px] text-white/65">For a pen-and-paper test: set it, put it on the projector, start. It keeps time even if the page reloads, and warns the room at 10, 5 and 1 minute.</p>

        <form className="mt-10 flex flex-col gap-7" onSubmit={(e) => { e.preventDefault(); if (total > 0) onStart({ title: title.trim(), note: note.trim(), total, endAt: Date.now() + total, left: null, chime: sound }); }}>
          <label className="block">
            <span className="font-mono text-[13px] text-white/50">what&apos;s it for</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Git fundamentals: written test"
              className="mt-2 w-full rounded-2xl border-2 border-white/15 bg-white/[0.04] px-4 py-3.5 text-[19px] font-semibold text-white placeholder:font-normal placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
          </label>

          <fieldset>
            <legend className="font-mono text-[13px] text-white/50">how long</legend>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setPreset(p)} aria-pressed={preset === p}
                  className={`rounded-xl border-2 py-3 text-center font-mono text-[17px] font-bold transition-colors ${preset === p ? "border-[#3fc84e] bg-[#3fc84e]/15 text-[#3fc84e]" : "border-white/10 bg-white/[0.04] text-white/80 hover:border-white/25"}`}>
                  {p >= 60 ? <>{Math.floor(p / 60)}<span className="text-[12px] font-normal opacity-60">h</span>{p % 60 || ""}</> : <>{p}<span className="ml-0.5 text-[12px] font-normal opacity-60">m</span></>}
                </button>
              ))}
            </div>
            <div className={`mt-3 flex items-center gap-2 rounded-2xl border-2 px-4 py-2.5 ${preset === null ? "border-[#3fc84e]" : "border-white/10"}`}>
              <span className="text-[15px] text-white/60">or exactly</span>
              <input value={h} onChange={(e) => { setH(e.target.value.replace(/\D/g, "").slice(0, 2)); setPreset(null); }} inputMode="numeric" placeholder="0" aria-label="Hours"
                className="w-12 rounded-lg bg-white/[0.06] px-2 py-1.5 text-center font-mono text-[18px] text-white focus:outline-none focus:ring-2 focus:ring-white/30" />
              <span className="text-white/50">h</span>
              <input value={m} onChange={(e) => { setM(e.target.value.replace(/\D/g, "").slice(0, 3)); setPreset(null); }} inputMode="numeric" placeholder="40" aria-label="Minutes"
                className="w-14 rounded-lg bg-white/[0.06] px-2 py-1.5 text-center font-mono text-[18px] text-white focus:outline-none focus:ring-2 focus:ring-white/30" />
              <span className="text-white/50">min</span>
            </div>
          </fieldset>

          <label className="block">
            <span className="font-mono text-[13px] text-white/50">a note for the room <span className="text-white/30">(optional, shown under the clock)</span></span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Phones away. Roll number on every sheet."
              className="mt-2 w-full rounded-2xl border-2 border-white/15 bg-white/[0.04] px-4 py-3.5 text-[17px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none" />
          </label>

          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-white/75">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="h-5 w-5 accent-[#3fc84e]" />
            Soft chime at 10, 5 and 1 minute, and at the end
          </label>

          <button disabled={total <= 0} className="flex items-center justify-center gap-2 rounded-full bg-[#3fc84e] py-4 text-[19px] font-bold text-[#0b0b0f] disabled:opacity-35">
            <PlayIcon size={20} />Start {total > 0 ? mins(total) : ""}
          </button>
        </form>
        <p className="mt-6 text-center text-[13px] text-white/40">On the projector: <kbd className="font-mono text-white/60">Space</kbd> pauses, <kbd className="font-mono text-white/60">F</kbd> goes full screen.</p>
      </div>
    </main>
  );
}

/* ---------------- running ---------------- */

function Running({ run, set }: { run: Run; set: (r: Run | null) => void }) {
  const still = useReducedMotion();
  useWakeLock();
  const [ask, dialog] = useConfirm();
  const [now, setNow] = useState(() => Date.now());
  const [banner, setBanner] = useState<string | null>(null);
  const [idle, setIdle] = useState(false);
  const last = useRef<number | null>(null);
  const live = run.endAt != null;
  const left = leftOf(run, now);
  const done = left === 0;

  // the clock, and the warnings when it passes 10, 5 and 1 minute
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const t = Date.now(), l = leftOf(run, t), was = last.current;
      setNow(t);
      if (live && was != null) {
        const crossed = WARN.find((w) => was > w && l <= w);
        if (crossed) { setBanner(crossed === MIN ? "1 minute left" : `${crossed / MIN} minutes left`); if (run.chime) chime(); clearTimeout(hide); hide = setTimeout(() => setBanner(null), 8000); }
        if (was > 0 && l === 0 && run.chime) chime(3);
      }
      last.current = l;
    };
    tick();
    const id = setInterval(tick, 250);
    return () => { clearInterval(id); clearTimeout(hide); };
  }, [run, live]);

  // controls hide when the mouse is still, so the projector shows only the time
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 3000); };
    wake();
    window.addEventListener("mousemove", wake); window.addEventListener("keydown", wake); window.addEventListener("touchstart", wake);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", wake); window.removeEventListener("keydown", wake); window.removeEventListener("touchstart", wake); };
  }, []);

  const pause = () => { if (done) return; unlock(); set(live ? { ...run, endAt: null, left: leftOf(run, Date.now()) } : { ...run, endAt: Date.now() + (run.left ?? run.total), left: null }); };
  const add = (ms: number) => {
    const l = Math.max(0, leftOf(run, Date.now()) + ms);
    last.current = l; // a change by hand isn't a warning
    set(live || done ? { ...run, total: run.total + ms, endAt: Date.now() + l, left: null } : { ...run, total: run.total + ms, left: l });
  };
  const full = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); };
  const stop = async () => {
    if (!done && !(await ask({ dark: true, danger: true, command: "$ git reset --hard", title: "Stop the timer?", body: `${clock(left)} is still left. The room's clock goes back to the start screen.`, yes: "Stop timer", no: "Keep running" }))) return;
    set(null);
  };

  // Space pauses, F goes full screen. Listened to once and pointed at this render's handlers: re-adding the listener
  // on every render would miss the key that wakes the hidden controls (that key re-renders mid-press).
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, button, dialog")) return;
      if (e.key === " ") { e.preventDefault(); pause(); }
      else if (e.key === "f" || e.key === "F") full();
    };
  });
  useEffect(() => {
    const k = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  const tone = done ? "text-[#ff7b72]" : left <= MIN ? "text-[#ff7b72]" : left <= 5 * MIN ? "text-[#ffa657]" : left <= 10 * MIN ? "text-[#ffc933]" : "text-white";
  const bar = left <= 5 * MIN ? "#ff7b72" : left <= 10 * MIN ? "#ffc933" : "#3fc84e";
  const ends = live ? run.endAt! : now + left;

  return (
    <main className={`flex h-dvh flex-col overflow-hidden px-4 py-4 text-white transition-colors duration-700 md:px-[3.5vw] md:py-[3.5vh] ${done ? "bg-[#2a0f12]" : "bg-[#0b0b0f]"} ${idle && !done ? "cursor-none" : ""}`}>
      {dialog}
      <header className={`flex items-center gap-3 text-[14px] transition-opacity duration-500 md:text-[2.1vh] ${idle ? "opacity-0" : "opacity-100"}`}>
        <span className="hidden font-mono text-white/45 sm:inline">git timer</span>
        <span className="min-w-0 truncate font-semibold">{run.title || "Test in progress"}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-white/55"><ClockIcon size={16} /><span className="tabular-nums">{at(now)}</span></span>
        <button onClick={() => set({ ...run, chime: !run.chime })} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label={run.chime ? "Turn the chime off" : "Turn the chime on"} title={run.chime ? "Chime on" : "Chime off"}>{run.chime ? <BellIcon size={18} /> : <BellSlashIcon size={18} />}</button>
        <button onClick={full} className="hidden rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white md:block" aria-label="Full screen"><ScreenFullIcon size={18} /></button>
        <button onClick={() => void stop()} className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Stop timer"><XIcon size={18} /></button>
      </header>

      <AnimatePresence>
        {banner && !done && (
          <motion.p role="alert" initial={still ? false : { y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="mx-auto mt-4 rounded-full px-6 py-2.5 text-[20px] font-bold text-[#0b0b0f] md:mt-[2vh] md:px-[2.5vw] md:py-[1.4vh] md:text-[3.6vh]" style={{ background: bar }}>{banner}</motion.p>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        {done ? (
          <motion.div initial={still ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="flex flex-col items-center">
            <Sticker name="riveter" size={240} tilt={-5} className="h-[120px] w-[120px] md:h-[22vh] md:w-[22vh]" />
            <h1 className="mt-6 text-[64px] leading-none md:text-[16vh]">Pens down.</h1>
            <p className="mt-4 font-mono text-[16px] text-white/60 md:text-[2.8vh]">$ git commit -m &quot;{run.title || "answers"}&quot; · time was up at {at(ends)}</p>
            <div className={`mt-8 flex gap-3 transition-opacity md:mt-[5vh] ${idle ? "opacity-0" : "opacity-100"}`}>
              <button onClick={() => add(5 * MIN)} className="flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-[15px] font-semibold md:text-[2.2vh]"><PlusIcon size={16} />5 more minutes</button>
              <button onClick={() => set(null)} className="rounded-full bg-white px-5 py-2.5 text-[15px] font-bold text-[#0b0b0f] md:text-[2.2vh]">New timer</button>
            </div>
          </motion.div>
        ) : (<>
          <p className="font-mono text-[14px] text-white/45 md:text-[2.6vh]">{live ? `$ git commit at ${at(ends)}` : "paused"}</p>
          <p className={`mt-2 font-mono font-bold leading-none tracking-[-0.04em] tabular-nums transition-colors duration-500 ${tone} ${!live ? "opacity-40" : ""} ${left <= MIN && live && !still ? "animate-pulse" : ""} ${left >= 3600_000 ? "text-[17vw] md:text-[min(19vw,34vh)]" : "text-[27vw] md:text-[min(25vw,40vh)]"}`}
            role="timer" aria-live="off" aria-label={`${clock(left)} left`}>{clock(left)}</p>
          <div className="mt-4 h-2 w-[min(80vw,1100px)] overflow-hidden rounded-full bg-white/10 md:mt-[3vh] md:h-[1vh]">
            <div className="h-full rounded-full transition-[width,background-color] duration-300 ease-linear" style={{ width: `${(left / run.total) * 100}%`, background: bar }} />
          </div>
          {run.note && <p className="mt-6 max-w-[40ch] text-[18px] text-white/70 md:mt-[4vh] md:text-[3.2vh]">{run.note}</p>}
        </>)}
      </div>

      {!done && (
        <footer className={`flex flex-wrap items-center justify-center gap-2 transition-opacity duration-500 ${idle ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <button onClick={pause} className="min-w-[120px] rounded-full bg-white px-6 py-3 text-[16px] font-bold text-[#0b0b0f] md:text-[2.2vh]">{live ? "Pause" : "Resume"}</button>
          <button onClick={() => add(5 * MIN)} className="rounded-full border border-white/20 px-4 py-3 font-mono text-[15px] hover:bg-white/[0.06] md:text-[2.1vh]">+5 min</button>
          <button onClick={() => add(MIN)} className="rounded-full border border-white/20 px-4 py-3 font-mono text-[15px] hover:bg-white/[0.06] md:text-[2.1vh]">+1 min</button>
          <button onClick={() => add(-MIN)} disabled={left <= MIN} className="rounded-full border border-white/20 px-4 py-3 font-mono text-[15px] hover:bg-white/[0.06] disabled:opacity-30 md:text-[2.1vh]">−1 min</button>
        </footer>
      )}
    </main>
  );
}
