"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FlameIcon, GitMergeIcon, GitPullRequestClosedIcon, SyncIcon } from "@primer/octicons-react";
import { Sticker } from "@/components/ui/Sticker";
import { useWakeLock } from "@/components/epoch/Kiosk";
import { useClientValue } from "@/lib/useClientValue";
import { cleanCode, openRoom, stickerFor, type Msg, type Room, type RoomState } from "@/lib/quiz/room";
import { Glyph, Rich, TILES, fmt } from "./Bits";

/* /quiz — the phone. Type the code from the big screen and a name, then tap shapes.
   The phone remembers which room it's in, so a refresh or a dropped connection drops you back in. */

const ME = "quiz:me", SEAT = "quiz:seat";
type Seat = { code: string; name: string };
const myId = () => {
  try { let id = localStorage.getItem(ME); if (!id) { id = crypto.randomUUID(); localStorage.setItem(ME, id); } return id; }
  catch { return crypto.randomUUID(); }
};

export function Player() {
  // what the browser already knows: the code in the QR link, the room this tab is in, the name used last time
  const urlCode = useClientValue(() => cleanCode(new URLSearchParams(location.search).get("code") || ""), "");
  const savedSeat = useClientValue(() => { try { return sessionStorage.getItem(SEAT); } catch { return null; } }, null);
  const savedName = useClientValue(() => { try { return localStorage.getItem("quiz:name") || ""; } catch { return ""; } }, "");
  const [chosen, setSeat] = useState<Seat | null | undefined>(undefined); // undefined: not decided here yet
  const [typedCode, setCode] = useState<string | null>(null), [typedName, setName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const code = typedCode ?? urlCode, name = typedName ?? savedName;
  const seat = chosen !== undefined ? chosen : restore(savedSeat, urlCode);

  const leave = useCallback((why = "") => { try { sessionStorage.removeItem(SEAT); } catch { /* fine */ } setSeat(null); setNote(why); }, []);

  if (seat) return <InRoom seat={seat} onLeave={leave} />;
  const ready = code.length === 6 && name.trim().length > 0;
  return (
    <main className="flex min-h-dvh flex-col bg-[#0b0b0f] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(40px,env(safe-area-inset-top))] text-white">
      <p className="font-mono text-[13px] text-white/50">{"// git quiz"}</p>
      <h1 className="mt-3 text-[44px]">Join the quiz.</h1>
      <p className="mt-2 text-[16px] text-white/60">The code is on the big screen.</p>
      <form className="mt-8 flex flex-col gap-5" onSubmit={(e) => {
        e.preventDefault(); if (!ready) return;
        const s = { code, name: name.trim().slice(0, 20) };
        try { sessionStorage.setItem(SEAT, JSON.stringify(s)); localStorage.setItem("quiz:name", s.name); } catch { /* fine */ }
        setNote(""); setSeat(s);
      }}>
        <label className="block">
          <span className="font-mono text-[13px] text-white/50">$ git checkout</span>
          <input value={code} onChange={(e) => setCode(cleanCode(e.target.value))} inputMode="text" autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="4f2a9c" aria-label="Quiz code"
            className="mt-2 w-full rounded-2xl border-2 border-white/15 bg-white/[0.04] px-4 py-4 text-center font-mono text-[40px] font-bold tracking-[0.2em] text-[#3fc84e] placeholder:text-white/15 focus:border-[#3fc84e] focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-[14px] text-white/60">Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="octocat"
            className="mt-2 w-full rounded-2xl border-2 border-white/15 bg-white/[0.04] px-4 py-3.5 text-[20px] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none" />
        </label>
        {note && <p className="rounded-xl bg-[#ff7b72]/15 px-4 py-3 text-[15px] text-[#ffb4a8]" role="alert">{note}</p>}
        <button disabled={!ready} className="mt-2 rounded-full bg-[#3fc84e] py-4 text-[19px] font-bold text-[#0b0b0f] disabled:opacity-35">Join</button>
      </form>
      <p className="mt-auto pt-10 text-center text-[13px] text-white/35">Hosting? Open <a href="/quiz/host" className="underline">/quiz/host</a> on the projector.</p>
    </main>
  );
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
  const seen = useRef(false), room = useRef<Room | null>(null), phase = useRef("");

  useEffect(() => {
    let r: Room | null = null, gone = false, tries = 0;
    const hello = () => r?.send({ t: "hello", id, name: seat.name });
    const onMsg = (m: Msg) => {
      if (m.t !== "state") return;
      const st = m.state;
      if (!st.results[id]) {
        // the host has us on record or it doesn't: once we were in, missing means removed
        if (seen.current) onLeave("The host removed you from this quiz.");
        return;
      }
      seen.current = true;
      if (st.phase === "question" && st.remaining != null) setEnds(Date.now() + st.remaining); // our own clock, not the host's
      if (phase.current && phase.current !== "reveal" && st.phase === "reveal") navigator.vibrate?.(st.results[id][3] === 1 ? 60 : [40, 60, 40]);
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

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0b0b0f] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] text-white">
      <header className="flex items-center gap-2.5 text-[14px]">
        <Sticker name={stickerFor(id)} size={28} />
        <b className="truncate">{seat.name}</b>
        {me && <span className="ml-auto font-mono tabular-nums text-white/70">{fmt(me[0])} pts</span>}
        <span className={`${me ? "" : "ml-auto"} h-2 w-2 shrink-0 rounded-full ${link ? "bg-[#3fc84e]" : "animate-blink bg-[#ffc933]"}`} title={link ? "Connected" : "Connecting"} />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={!s ? "wait" : s.phase === "question" ? `q${s.index}${mine ?? ""}` : s.phase + s.index} className="flex min-h-0 flex-1 flex-col"
          initial={still ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={still ? undefined : { opacity: 0, scale: 0.98 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>

          {(!s || s.phase === "lobby") && (
            <Center>
              {s ? <>
                <motion.div initial={still ? false : { y: 30, rotate: -14, opacity: 0 }} animate={{ y: 0, rotate: -5, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}><Sticker name={stickerFor(id)} size={160} /></motion.div>
                <h2 className="mt-6 text-[34px]">You&apos;re in.</h2>
                <p className="mt-2 text-[17px] text-white/60">Look at the big screen. It starts soon.</p>
                <p className="mt-6 font-mono text-[13px] text-white/40">on {seat.code} · {total} joined</p>
              </> : <>
                <SyncIcon size={28} className="animate-spin text-white/50 motion-reduce:animate-none" />
                <p className="mt-4 text-[17px] text-white/60">Joining <span className="font-mono text-[#3fc84e]">{seat.code}</span>…</p>
                <button onClick={() => onLeave()} className="mt-8 text-[14px] text-white/45 underline">Wrong code?</button>
              </>}
            </Center>
          )}

          {s?.phase === "question" && s.question && (mine === null ? (
            <div className="flex min-h-0 flex-1 flex-col pt-4">
              <div className="flex items-center justify-between font-mono text-[14px] text-white/50"><span>{s.index + 1}/{s.total}</span><span className={`text-[20px] font-bold tabular-nums ${left <= 5 ? "text-[#ff7b72]" : "text-white"}`}>{left}</span></div>
              <p className="mt-2 text-[20px] font-semibold leading-snug"><Rich text={s.question.q} /></p>
              <div className={`mt-4 grid min-h-0 flex-1 gap-3 ${s.question.options.length > 2 ? "grid-cols-2 grid-rows-2" : "grid-rows-2"}`}>
                {s.question.options.map((o, i) => (
                  <button key={i} onClick={() => answer(i)} disabled={left === 0} aria-label={`${TILES[i].name}: ${o}`}
                    className="flex flex-col items-center justify-center gap-2 rounded-3xl p-3 text-[#0b0b0f] active:scale-95 disabled:opacity-40" style={{ background: TILES[i].color }}>
                    <Glyph i={i} className="h-14 w-14" />
                    <span className="line-clamp-3 text-center text-[16px] font-semibold leading-tight"><Rich text={o} /></span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Center>
              <span className="grid h-28 w-28 place-items-center rounded-3xl text-[#0b0b0f]" style={{ background: TILES[mine].color }}><Glyph i={mine} className="h-14 w-14" /></span>
              <h2 className="mt-6 text-[30px]">Pushed.</h2>
              <p className="mt-2 font-mono text-[14px] text-white/50">waiting for checks… {left}s</p>
            </Center>
          ))}

          {s?.phase === "reveal" && me && (
            <Center className={me[3] === 1 ? "text-[#4fd1a1]" : "text-[#ff7b72]"}>
              <motion.span initial={still ? false : { scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 14 }}>
                {me[3] === 1 ? <GitMergeIcon size={88} /> : <GitPullRequestClosedIcon size={88} />}
              </motion.span>
              <h2 className="mt-5 text-[40px] text-white">{me[3] === 1 ? "Merged!" : me[3] === 0 ? "Conflict." : "Timed out."}</h2>
              {me[3] === 1 ? <p className="mt-2 rounded-full bg-[#1a7f37] px-4 py-1 font-mono text-[24px] font-bold text-white">+{me[2]}</p>
                : s.question && s.answer != null && <p className="mt-3 max-w-[30ch] text-[16px] text-white/70">It was <b className="text-white"><Rich text={s.question.options[s.answer]} /></b></p>}
              {me[4] >= 2 && <p className="mt-4 flex items-center gap-1.5 text-[16px] text-[#ffa657]"><FlameIcon size={18} />{me[4]} in a row</p>}
              <p className="mt-6 text-[16px] text-white/60">You&apos;re #{me[1]} of {total}</p>
            </Center>
          )}

          {s?.phase === "board" && me && (
            <Center>
              <p className="font-mono text-[14px] text-white/50">$ git shortlog -sn</p>
              <p className="mt-3 font-mono text-[88px] font-bold leading-none text-[#ffc933]">#{me[1]}</p>
              <p className="mt-3 text-[18px] text-white/70">{fmt(me[0])} points · {total} playing</p>
              <p className="mt-8 text-[15px] text-white/45">Next question coming up.</p>
            </Center>
          )}

          {s?.phase === "end" && me && (
            <Center>
              <motion.div initial={still ? false : { y: -120, rotate: -20, opacity: 0 }} animate={{ y: 0, rotate: 4, opacity: 1 }} transition={{ type: "spring", stiffness: 240, damping: 13 }}><Sticker name={stickerFor(id)} size={170} /></motion.div>
              <p className="mt-6 font-mono text-[14px] text-white/50">git tag v1.0.0</p>
              <h2 className="mt-2 text-[44px]">{me[1] === 1 ? "You won!" : me[1] <= 3 ? `#${me[1]} — podium!` : `You came #${me[1]}`}</h2>
              <p className="mt-2 text-[18px] text-white/70">{fmt(me[0])} points · {s.title}</p>
              <button onClick={() => onLeave()} className="mt-10 rounded-full border border-white/20 px-6 py-3 text-[16px]">Done</button>
            </Center>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

const Center = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex flex-1 flex-col items-center justify-center text-center ${className}`}>{children}</div>
);

/** The room this tab was in before a refresh, unless the QR link points at a different one. */
function restore(raw: string | null, urlCode: string): Seat | null {
  try { const s = JSON.parse(raw || "null") as Seat | null; return s?.code && (!urlCode || s.code === urlCode) ? s : null; }
  catch { return null; }
}
