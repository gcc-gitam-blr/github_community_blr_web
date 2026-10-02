"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Sticker, type StickerName } from "@/components/ui/Sticker";
import { Coin } from "../Bits";
import { BOOTHS } from "@/lib/epoch/config";
import type { Booth } from "@/lib/epoch/types";

/* 21 booths is too many to read in one go, so they're grouped into four
   and shown one group at a time. Each group has its own Octodex mascot. */
const GROUPS: { id: string; label: string; sticker: StickerName; tint: string; line: string; test: (b: Booth) => boolean }[] = [
  { id: "recharge", label: "Recharge points", sticker: "jetpack", tint: "#ffd966", line: "Earn coins. One go at each.", test: (b) => b.kind === "recharge" },
  { id: "play", label: "Play", sticker: "skate", tint: "#d9c8f7", line: "VR, arcades and giant games.", test: (b) => b.kind !== "recharge" && b.category === "Play" },
  { id: "make", label: "Make", sticker: "film", tint: "#bfeedd", line: "Paint, fold, print, dub.", test: (b) => b.kind !== "recharge" && b.category === "Make" },
  { id: "explore", label: "Explore & compete", sticker: "adventure", tint: "#cfe6f7", line: "Startups, fortunes, an escape room.", test: (b) => b.kind !== "recharge" && (b.category === "Explore" || b.category === "Compete") },
];

function Price({ b }: { b: Booth }) {
  const base = "inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[12px] font-bold";
  if (b.kind === "free") return <span className={`${base} bg-ink/[.06] text-mute`}>free</span>;
  if (b.kind === "recharge") return <span className={`${base} bg-[#ffd966]`}><Coin size={14} />+{b.coins} once</span>;
  return <span className={`${base} bg-ink text-white`}><Coin size={14} />{b.coins} / go</span>;
}

export function BoothSection() {
  const [g, setG] = useState(GROUPS[0]);
  const list = BOOTHS.filter(g.test);
  return (
    <div>
      <div role="tablist" aria-label="Booth groups" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {GROUPS.map((x) => {
          const on = x.id === g.id; const n = BOOTHS.filter(x.test).length;
          return (
            <button key={x.id} role="tab" aria-selected={on} onClick={() => setG(x)} style={{ background: on ? x.tint : undefined }}
              className={`group relative flex items-center gap-3 overflow-visible rounded-[20px] border-2 p-3 pr-4 text-left transition ${on ? "border-ink" : "border-ink/10 bg-white hover:border-ink/40"}`}>
              <Sticker name={x.sticker} size={58} tilt={on ? -8 : 0} className="flex-none transition-transform duration-300 group-hover:-rotate-6" alt="" />
              <span className="min-w-0"><span className="block text-[17px] font-medium leading-tight tracking-[-0.02em]">{x.label}</span><span className="font-mono text-[12px] text-mute">{n} booths</span></span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-8">
        <p className="mb-5 text-[19px] text-mute">{g.line}</p>
        <motion.ul layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((b, i) => (
              <motion.li key={b.id} layout initial={{ opacity: 0, transform: "translateY(10px)" }} animate={{ opacity: 1, transform: "translateY(0px)", transition: { delay: i * 0.03, duration: 0.25, ease: [0.23, 1, 0.32, 1] } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                className="flex flex-col gap-3 rounded-[18px] border border-ink/10 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[19px] leading-tight">{b.name}</h3>
                  <Price b={b} />
                </div>
                <p className="text-[15px] leading-snug text-mute">{b.blurb}{b.optional && <span className="ml-1 font-mono text-[11px] uppercase text-mute/70">· optional</span>}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    </div>
  );
}
