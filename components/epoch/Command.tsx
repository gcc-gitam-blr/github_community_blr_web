"use client";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { EpochCoin } from "./EpochCoin";
import { search, type Hit } from "@/lib/epoch/ask";

/* The command bar: press “/” (or ⌘/Ctrl-K) anywhere in Epoch. Type to jump to a page,
   a booth or a session, or ask a question (“how much is VR?”, “when do recharge points work?”). */

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useCommand = () => useContext(Ctx);

export function Orb({ size = 44 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size }} className="relative grid flex-none place-items-center rounded-full bg-[radial-gradient(circle_at_30%_22%,#cfe2ff,#5b6cff_52%,#8a3fe6)] shadow-[0_8px_24px_-6px_rgba(91,108,255,.8),inset_0_1px_2px_rgba(255,255,255,.7)]">
      <EpochCoin size={size * 0.62} detail={false} />
    </span>
  );
}

const KEY = "rounded-xl border border-ink/15 bg-white/70 px-2.5 py-1 font-mono text-[13px] text-mute shadow-[inset_0_-1px_0_rgba(0,0,0,.08)]";

/** The glass pill. `hero` is the big centrepiece; `bar` is the slim one in the top bar. */
export function Launcher({ variant = "bar", className = "" }: { variant?: "hero" | "bar"; className?: string }) {
  const { open } = useCommand();
  const big = variant === "hero";
  return (
    <div className={`relative ${className}`}>
      {/* the soft colour glow that sits beneath the pill */}
      <span aria-hidden className={`pointer-events-none absolute inset-x-[16%] ${big ? "-bottom-4 h-8" : "-bottom-2 h-4"} animate-[glow_6s_ease-in-out_infinite] rounded-full bg-[linear-gradient(90deg,#7aa8ff,#5eead4,#a78bfa)] opacity-60 blur-xl`} />
      <button onClick={open} aria-label="Search Epoch or ask a question" className={`relative flex w-full items-center gap-4 rounded-full border border-white/80 bg-white/70 text-left shadow-[0_18px_50px_-22px_rgba(70,45,130,.45),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-2xl transition hover:bg-white/85 ${big ? "h-[76px] pl-8 pr-4 text-[clamp(17px,2vw,21px)]" : "h-[52px] pl-6 pr-2.5 text-[15px]"}`}>
        <svg viewBox="0 0 24 24" width={big ? 26 : 20} height={big ? 26 : 20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-none text-mute" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span className="min-w-0 flex-1 truncate text-mute"><span className="hidden sm:inline">Search Epoch or </span>ask a question…</span>
        <kbd className={`${KEY} hidden sm:block`}>/</kbd>
        <Orb size={big ? 52 : 36} />
      </button>
    </div>
  );
}

const KIND: Record<Hit["kind"], string> = { page: "Page", booth: "Booth", plan: "Plan", merch: "Merch", answer: "Answer" };

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState(""); const [i, setI] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => search(q), [q]);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => setI(0), [q]);

  const go = (h?: Hit) => { if (!h) return; if (h.href) { onClose(); if (h.href.includes("#") && h.href.split("#")[0] === window.location.pathname) window.location.hash = h.href.split("#")[1]; else router.push(h.href); } };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(hits.length - 1, n + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(hits[i]); }
  };

  return (
    <motion.div className="fixed inset-0 z-[120] flex items-start justify-center bg-[#ece7f6]/55 px-4 pt-[14vh] backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-label="Search Epoch" className="w-full max-w-[680px]" initial={{ y: -16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute inset-x-[14%] -bottom-3 h-6 animate-[glow_6s_ease-in-out_infinite] rounded-full bg-[linear-gradient(90deg,#7aa8ff,#5eead4,#a78bfa)] opacity-70 blur-xl" />
          <div className="relative flex h-[72px] items-center gap-4 rounded-full border border-white/90 bg-white/85 pl-7 pr-3 shadow-[0_30px_80px_-30px_rgba(70,45,130,.6)] backdrop-blur-2xl">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-none text-mute" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search booths, the plan… or ask “how much is VR?”" aria-label="Search" spellCheck={false} className="cmd-input min-w-0 flex-1 bg-transparent text-[19px] outline-none placeholder:text-mute/70" />
            <kbd className={KEY}>esc</kbd>
            <Orb size={48} />
          </div>
        </div>

        <ul role="listbox" data-lenis-prevent className="mt-6 max-h-[52vh] overflow-y-auto rounded-[32px] border border-white/80 bg-white/75 p-2.5 shadow-[0_30px_80px_-35px_rgba(70,45,130,.55)] backdrop-blur-2xl">
          {!q && <li className="px-4 pb-1 pt-2 text-[13px] text-mute">Try: “how much is VR”, “recharge”, “hoodie”, “when is day 2”</li>}
          {hits.length === 0 && <li className="px-4 py-6 text-mute">Nothing found. Try “booths”, “ticket” or “merch”.</li>}
          {hits.map((h, n) => (
            <li key={h.id} role="option" aria-selected={n === i}>
              <button onMouseEnter={() => setI(n)} onClick={() => go(h)} className={`flex w-full items-center gap-4 rounded-[22px] px-4 py-3.5 text-left transition ${n === i ? "bg-ink/[.06]" : ""} ${h.kind === "answer" ? "bg-gradient-to-r from-[#e6e0ff]/70 to-[#ffe9c9]/60" : ""}`}>
                {h.kind === "answer" ? <Orb size={34} /> : <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-hair text-[11px] text-mute">{KIND[h.kind].slice(0, 2)}</span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-[17px] font-medium tracking-[-0.02em]">{h.title}</span>{h.sub && <span className="block text-[14px] leading-snug text-mute">{h.sub}</span>}</span>
                <span className="text-[12px] text-mute">{KIND[h.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const open = useCallback(() => setOn(true), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); setOn(true); }
      else if (e.key === "Escape") setOn(false);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <AnimatePresence>{on && <Palette onClose={() => setOn(false)} />}</AnimatePresence>
    </Ctx.Provider>
  );
}
