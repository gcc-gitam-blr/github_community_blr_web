"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { ArrowUpIcon, CheckIcon, FlameIcon, GitMergeIcon, GitPullRequestClosedIcon, SyncIcon } from "@primer/octicons-react";
import { Sticker, type StickerName } from "@/components/ui/Sticker";
import { useWakeLock } from "@/components/epoch/Kiosk";
import { useClientValue } from "@/lib/useClientValue";
import { STICKERS, cleanCode, isSticker, openRoom, type Msg, type Room, type RoomState } from "@/lib/quiz/room";
import { Glyph, Rich, TILES, fmt } from "./Bits";

/* /quiz — the phone. Type the code from the big screen, a name, pick a character, then tap shapes.
   The phone remembers which room it's in, so a refresh or a dropped connection drops you back in. */

const ME = "quiz:me", SEAT = "quiz:seat";
type Seat = { code: string; name: string; sticker: string };
const S = (s: string) => s as StickerName;
const myId = () => {
  try { let id = localStorage.getItem(ME); if (!id) { id = crypto.randomUUID(); localStorage.setItem(ME, id); } return id; }
  catch { return crypto.randomUUID(); }
};

export function Player() {
  // what the browser already knows: the code in the QR link, the room this tab is in, the name and character used last time
  const urlCode = useClientValue(() => cleanCode(new URLSearchParams(location.search).get("code") || ""), "");
  const savedSeat = useClientValue(() => { try { return sessionStorage.getItem(SEAT); } catch { return null; } }, null);
  const savedName = useClientValue(() => { try { return localStorage.getItem("quiz:name") || ""; } catch { return ""; } }, "");
  const savedSticker = useClientValue(() => { try { return localStorage.getItem("quiz:sticker") || ""; } catch { return ""; } }, "");
  const [chosen, setSeat] = useState<Seat | null | undefined>(undefined); // undefined: not decided here yet
  const [typedCode, setCode] = useState<string | null>(null), [typedName, setName] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const still = useReducedMotion();
  const code = typedCode ?? urlCode, name = typedName ?? savedName;
  const sticker = pick ?? (isSticker(savedSticker) ? savedSticker : "octocat");
  const seat = chosen !== undefined ? chosen : restore(savedSeat, urlCode);

  const leave = useCallback((why = "") => { try { sessionStorage.removeItem(SEAT); } catch { /* fine */ } setSeat(null); setNote(why); }, []);

  if (seat) return <InRoom seat={seat} onLeave={leave} />;
  const ready = code.length === 6 && name.trim().length > 0;
  return (
    <main className="flex min-h-dvh flex-col bg-[#0b0b0f] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(28px,env(safe-area-inset-top))] text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[13px] text-white/50">{"// git quiz"}</p>
          <h1 className="mt-3 text-[42px] leading-none">Join the<br />quiz.</h1>
        </div>
        <motion.div key={sticker} initial={still ? false : { scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 6 }} transition={{ type: "spring", stiffness: 420, damping: 14 }}>
          <Sticker name={S(sticker)} size={110} />
        </motion.div>
      </div>

      <form className="mt-7 flex flex-col gap-5" onSubmit={(e) => {
        e.preventDefault(); if (!ready) return;
        const s = { code, name: name.trim().slice(0, 20), sticker };
        try { sessionStorage.setItem(SEAT, JSON.stringify(s)); localStorage.setItem("quiz:name", s.name); localStorage.setItem("quiz:sticker", sticker); } catch { /* fine */ }
        setNote(""); setSeat(s);
      }}>
        <label className="block">
          <span className="font-mono text-[13px] text-white/50">$ git checkout</span>
          <input value={code} onChange={(e) => setCode(cleanCode(e.target.value))} inputMode="text" autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="a1b2c3" aria-label="Quiz code"
            className={`mt-2 w-full rounded-2xl border-2 bg-white/[0.04] px-4 py-3.5 text-center font-mono text-[38px] font-bold tracking-[0.2em] text-[#3fc84e] placeholder:text-white/15 focus:outline-none ${code.length === 6 ? "border-[#3fc84e]" : "border-white/15 focus:border-white/40"}`} />
        </label>
        <label className="block">
          <span className="text-[14px] text-white/60">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="octocat"
            className="mt-2 w-full rounded-2xl border-2 border-white/15 bg-white/[0.04] px-4 py-3.5 text-[20px] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none" />
        </label>
        <fieldset>
          <legend className="text-[14px] text-white/60">Pick your character</legend>
          <div className="-mx-5 mt-2 flex snap-x gap-2 overflow-x-auto px-5 pb-2 pt-1 [scrollbar-width:none]">
            {STICKERS.map((s) => (
              <button key={s} type="button" onClick={() => setPick(s)} aria-pressed={s === sticker} aria-label={s}
                className={`grid h-[76px] w-[76px] shrink-0 snap-start place-items-center rounded-2xl border-2 transition-[background-color,border-color,transform] duration-150 ${s === sticker ? "-translate-y-1 border-[#3fc84e] bg-[#3fc84e]/15" : "border-white/10 bg-white/[0.04]"}`}>
                <Sticker name={s} size={58} />
              </button>
            ))}
          </div>
        </fieldset>
        {note && <p className="rounded-xl bg-[#ff7b72]/15 px-4 py-3 text-[15px] text-[#ffb4a8]" role="alert">{note}</p>}
        <button disabled={!ready} className="mt-1 rounded-full bg-[#3fc84e] py-4 text-[19px] font-bold text-[#0b0b0f] transition-opacity disabled:opacity-35">Join as {name.trim() || "…"}</button>
      </form>
    </main>
  );
}

/** The room this tab was in before a refresh, unless the QR link points at a different one. */
function restore(raw: string | null, urlCode: string): Seat | null {
  try { const s = JSON.parse(raw || "null") as Seat | null; return s?.code && (!urlCode || s.code === urlCode) ? { ...s, sticker: isSticker(s.sticker) ? s.sticker : "octocat" } : null; }
  catch { return null; }
}

function InRoom({ seat, onLeave }: { seat: Seat; onLeave: (why?: string) => void }) {
  const still = useReducedMotion();
  useWakeLock();
  const [id] = useState(myId);
  const [s, setS] = useState<RoomState | null>(null);
  const [picked, setPicked] = useState<{ index: number; choice: number } | null>(null);
  const [link, setLink] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [ends, setEnds] = useState(0);
  const [climb, setClimb] = useState(0); // places gained this round
  const seen = useRef(false), room = useRef<Room | null>(null), phase = useRef(""), rankBefore = useRef(0);

  useEffect(() => {
    let r: Room | null = null, gone = false, tries = 0;
    const hello = () => r?.send({ t: "hello", id, name: seat.name, sticker: seat.sticker });
    const onMsg = (m: Msg) => {
      if (m.t !== "state") return;
      const st = m.state, mine = st.results[id];
      if (!mine) {
        // the host has us on record or it doesn't: once we were in, missing means removed
        if (seen.current) onLeave("The host removed you from this quiz.");
        return;
      }
      seen.current = true;
      if (st.phase === "question" && st.remaining != null) setEnds(Date.now() + st.remaining); // our own clock, not the host's
      if (st.phase === "question" && phase.current !== "question") rankBefore.current = mine[1];
      if (st.phase === "reveal" && phase.current && phase.current !== "reveal") {
        navigator.vibrate?.(mine[3] === 1 ? 80 : [40, 60, 40]);
        setClimb(rankBefore.current ? rankBefore.current - mine[1] : 0);
      }
      phase.current = st.phase;
      setS(st);
    };
    // say hello until the host answers; the host replies with the room's state
    const retry = setInterval(() => {
      if (seen.current) return;
      if (++tries > 6) { clearInterval(retry); onLeave(`No quiz is running with the code ${seat.code}. Check the big screen.`); return; }
      hello();
    }, 2500);
    void openRoom(seat.code, "player", onMsg, (ok) => { if (gone) return; setLink(ok); if (ok) hello(); }).then((x) => {
      if (gone) return x.close();
      r = x; room.current = x;
      if (!x.live) hello();
    });
    const back = () => { if (document.visibilityState === "visible") hello(); }; // the phone slept: ask where we are
    document.addEventListener("visibilitychange", back);
    return () => { gone = true; clearInterval(retry); document.removeEventListener("visibilitychange", back); r?.close(); room.current = null; };
  }, [seat, id, onLeave]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const answer = (choice: number) => {
    if (!s || s.phase !== "question" || picked?.index === s.index) return;
    setPicked({ index: s.index, choice });
    navigator.vibrate?.(15);
    room.current?.send({ t: "answer", id, index: s.index, choice });
  };

  const me = s?.results[id];
  const mine = picked && s && picked.index === s.index ? picked.choice : null;
  const left = Math.max(0, Math.ceil((ends - now) / 1000));
  const total = s ? Object.keys(s.results).length : 0;
  const others = s ? Object.entries(s.people ?? {}).filter(([pid]) => pid !== id) : [];
  // who's just ahead of us, for "catch up" on the scores screen
  const ahead = s && me && me[1] > 1 ? Object.entries(s.results).find(([, r]) => r[1] === me[1] - 1) : undefined;
  const result = s?.phase === "reveal" && me ? me[3] : null;
  const bg = result === 1 ? "#4fd1a1" : result === 0 ? "#ff7b72" : result === -1 ? "#2a2c33" : "#0b0b0f";
  const ink = result === 1 || result === 0 ? "text-[#0b0b0f]" : "text-white";

  return (
    <main className={`flex h-dvh flex-col overflow-hidden px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] transition-colors duration-300 ${ink}`} style={{ background: bg }}>
      <header className="flex items-center gap-2.5 text-[14px]">
        <Sticker name={S(seat.sticker)} size={32} />
        <b className="truncate">{seat.name}</b>
        {me && <span className="ml-auto rounded-full bg-current/10 px-3 py-1 font-mono tabular-nums">{fmt(me[0])} pts</span>}
        <span className={`${me ? "" : "ml-auto"} h-2 w-2 shrink-0 rounded-full ${link ? "bg-[#3fc84e]" : "animate-blink bg-[#ffc933]"}`} title={link ? "Connected" : "Connecting"} />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={!s ? "wait" : s.phase === "question" ? `q${s.index}` : s.phase + s.index} className="flex min-h-0 flex-1 flex-col"
          initial={still ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={still ? undefined : { opacity: 0, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>

          {(!s || s.phase === "lobby") && (
            <Center>
              {s ? <>
                <motion.div initial={still ? false : { y: 40, rotate: -14, opacity: 0 }} animate={{ y: 0, rotate: -4, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
                  <span className="block animate-[float-y_3.2s_ease-in-out_infinite] motion-reduce:animate-none"><Sticker name={S(seat.sticker)} size={170} /></span>
                </motion.div>
                <h2 className="mt-6 text-[36px]">You&apos;re in!</h2>
                <p className="mt-2 text-[17px] text-white/60">Eyes on the big screen. It starts soon.</p>
                <div className="mt-8 flex flex-col items-center gap-2">
                  <div className="flex -space-x-3">
                    {others.slice(-8).map(([pid, [, st]]) => <motion.span key={pid} initial={still ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}><Sticker name={S(st)} size={44} /></motion.span>)}
                  </div>
                  <p className="font-mono text-[13px] text-white/45">{others.length ? `${others.length} other${others.length === 1 ? "" : "s"} here` : "you're the first one here"} · {seat.code}</p>
                </div>
              </> : <>
                <span className="animate-[float-y_2.4s_ease-in-out_infinite] motion-reduce:animate-none"><Sticker name={S(seat.sticker)} size={120} tilt={-6} /></span>
                <p className="mt-6 flex items-center gap-2 text-[17px] text-white/70"><SyncIcon size={18} className="animate-spin motion-reduce:animate-none" />Joining <span className="font-mono text-[#3fc84e]">{seat.code}</span>…</p>
                <button onClick={() => onLeave()} className="mt-8 text-[14px] text-white/45 underline">Wrong code?</button>
              </>}
            </Center>
          )}

          {s?.phase === "question" && s.question && (
            <div className="flex min-h-0 flex-1 flex-col pt-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px] text-white/50">{s.index + 1}/{s.total}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-[width] duration-300 ease-linear ${left <= 5 ? "bg-[#ff7b72]" : "bg-[#ffc933]"}`} style={{ width: `${Math.max(0, Math.min(100, (ends - now) / (s.question.time * 10)))}%` }} /></div>
                <span className={`w-7 text-right font-mono text-[18px] font-bold tabular-nums ${left <= 5 ? "text-[#ff7b72]" : "text-white"}`}>{left}</span>
              </div>
              <p className="mt-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-[18px] font-semibold leading-snug"><Rich text={s.question.q} /></p>
              <div className={`mt-3 grid min-h-0 flex-1 gap-3 ${s.question.options.length > 2 ? "grid-cols-2 grid-rows-2" : "grid-rows-2"}`}>
                {s.question.options.map((o, i) => {
                  const chosen = mine === i, out = mine !== null && !chosen;
                  return (
                    <motion.button key={i} onClick={() => answer(i)} disabled={left === 0 || mine !== null} aria-label={`${TILES[i].name}: ${o}`} aria-pressed={chosen}
                      animate={{ scale: chosen ? 1.04 : out ? 0.94 : 1, opacity: out ? 0.25 : left === 0 && mine === null ? 0.4 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 24 }}
                      className={`relative flex flex-col items-center justify-center gap-2 rounded-3xl p-3 text-[#0b0b0f] shadow-[inset_0_-6px_0_rgba(0,0,0,0.18)] active:shadow-none ${chosen ? "ring-4 ring-white" : ""}`} style={{ background: TILES[i].color }}>
                      <Glyph i={i} className="h-12 w-12" />
                      <span className="line-clamp-3 text-center text-[16px] font-semibold leading-tight"><Rich text={o} /></span>
                      {chosen && <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-[#0b0b0f] text-white"><CheckIcon size={16} /></span>}
                    </motion.button>
                  );
                })}
              </div>
              <p className="mt-3 h-6 text-center font-mono text-[14px] text-white/60" aria-live="polite">
                {mine !== null ? <>pushed · waiting for checks<Dots /></> : left === 0 ? "time's up" : "tap your answer"}
              </p>
            </div>
          )}

          {s?.phase === "reveal" && me && (
            <Center>
              <motion.span initial={still ? false : { scale: 0.3, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 12 }}
                className="grid h-32 w-32 place-items-center rounded-full bg-[#0b0b0f] text-white">
                {me[3] === 1 ? <GitMergeIcon size={64} /> : <GitPullRequestClosedIcon size={64} />}
              </motion.span>
              <h2 className="mt-6 text-[48px] leading-none">{me[3] === 1 ? "Merged!" : me[3] === 0 ? "Conflict." : "Timed out."}</h2>
              {me[3] === 1 ? <p className="mt-4 rounded-full bg-[#0b0b0f] px-5 py-1.5 font-mono text-[28px] font-bold text-white">+<CountUp to={me[2]} /></p>
                : s.question && s.answer != null && <p className="mt-4 max-w-[30ch] text-[17px] opacity-80">The answer was <b><Rich text={s.question.options[s.answer]} /></b></p>}
              {me[4] >= 2 && <p className="mt-4 flex items-center gap-1.5 rounded-full bg-[#0b0b0f]/85 px-3 py-1 text-[15px] font-semibold text-[#ffa657]"><FlameIcon size={16} />{me[4]} in a row</p>}
              <p className="mt-6 text-[17px] font-semibold opacity-80">#{me[1]} of {total}{climb > 0 && <span className="ml-2 inline-flex items-center gap-0.5"><ArrowUpIcon size={16} />{climb}</span>}</p>
            </Center>
          )}

          {s?.phase === "board" && me && (
            <Center>
              <p className="font-mono text-[14px] text-white/50">$ git shortlog -sn</p>
              <p className="mt-3 font-mono text-[96px] font-bold leading-none text-[#ffc933]">#{me[1]}</p>
              <p className="mt-3 text-[18px] text-white/75">{fmt(me[0])} points · {total} playing</p>
              {ahead && s.people?.[ahead[0]] && (
                <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-left">
                  <Sticker name={S(s.people[ahead[0]][1])} size={40} />
                  <p className="text-[15px] text-white/75"><b className="text-white">{fmt(ahead[1][0] - me[0])} pts</b> behind {s.people[ahead[0]][0]}.<br />Next one&apos;s yours.</p>
                </div>
              )}
              {me[1] === 1 && <p className="mt-8 rounded-2xl bg-[#ffc933]/15 px-4 py-3 text-[16px] text-[#ffe28f]">You&apos;re in the lead. Hold it!</p>}
            </Center>
          )}

          {s?.phase === "end" && me && (
            <Center>
              <div className="flex items-end gap-2">
                {[2, 1, 3].map((rank) => {
                  const e = Object.entries(s.results).find(([, r]) => r[1] === rank);
                  const who = e && s.people?.[e[0]];
                  if (!e || !who) return null;
                  return (
                    <motion.div key={rank} initial={still ? false : { y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: still ? 0 : [0.5, 1, 0.2][rank - 1] }} className="flex w-[88px] flex-col items-center">
                      <Sticker name={S(who[1])} size={rank === 1 ? 70 : 54} />
                      <p className="mt-1 max-w-full truncate text-[13px] font-semibold">{who[0]}</p>
                      <div className={`mt-1 flex w-full justify-center rounded-t-lg pt-1 font-mono text-[18px] font-bold text-[#0b0b0f] ${["h-16", "h-11", "h-8"][rank - 1]} ${e[0] === id ? "ring-2 ring-white" : ""}`} style={{ background: ["#ffc933", TILES[1].color, TILES[0].color][rank - 1] }}>{rank}</div>
                    </motion.div>
                  );
                })}
              </div>
              <p className="mt-8 font-mono text-[14px] text-white/50">git tag v1.0.0</p>
              <h2 className="mt-2 text-[44px] leading-none">{me[1] === 1 ? "You won!" : me[1] <= 3 ? `#${me[1]}, podium!` : `You came #${me[1]}`}</h2>
              <p className="mt-3 text-[18px] text-white/70">{fmt(me[0])} points · {s.title}</p>
              <button onClick={() => onLeave()} className="mt-10 rounded-full border border-white/20 px-6 py-3 text-[16px]">Done</button>
            </Center>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center text-center">{children}</div>
);

const Dots = () => <span className="inline-flex w-5">{[0, 1, 2].map((i) => <span key={i} className="animate-blink motion-reduce:animate-none" style={{ animationDelay: `${i * 0.25}s` }}>.</span>)}</span>;

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => { const a = animate(0, to, { duration: 0.9, ease: [0.23, 1, 0.32, 1], onUpdate: (v) => setN(Math.round(v)) }); return () => a.stop(); }, [to]);
  return <>{n}</>;
}
