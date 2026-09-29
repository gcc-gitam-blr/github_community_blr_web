"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Coin, mono } from "../Bits";
import { BOOTHS, EPOCH } from "@/lib/epoch/config";
import type { Booth } from "@/lib/epoch/types";

const FILTERS = ["All", "Recharge", "Play", "Make", "Explore", "Compete"] as const;
const tone: Record<string, string> = {
  Play: "from-[#b48be6]/25 to-transparent border-[#b48be6]/30",
  Make: "from-[#4fd1a1]/22 to-transparent border-[#4fd1a1]/30",
  Explore: "from-[#b9e0f7]/22 to-transparent border-[#b9e0f7]/30",
  Compete: "from-white/10 to-transparent border-white/15",
};

function Price({ b }: { b: Booth }) {
  if (b.kind === "free") return <span className={`${mono} rounded-full bg-white/10 px-3 py-1 text-fog`}>Free</span>;
  if (b.kind === "recharge") return <span className={`${mono} flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 font-bold text-night`}><Coin size={14} />+{b.coins} · once</span>;
  return <span className={`${mono} flex items-center gap-1.5 rounded-full bg-night-3 px-3 py-1 font-bold text-gold`}><Coin size={14} />−{b.coins} / session</span>;
}

export function BoothExplorer({ compact = false }: { compact?: boolean }) {
  const [f, setF] = useState<(typeof FILTERS)[number]>("All");
  const list = BOOTHS.filter((b) => (f === "All" ? true : f === "Recharge" ? b.kind === "recharge" : b.kind !== "recharge" && b.category === f));
  return (
    <div>
      <div role="tablist" aria-label="Filter booths" className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <button key={x} role="tab" aria-selected={f === x} onClick={() => setF(x)} className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${f === x ? "border-gold bg-gold text-night" : "border-white/15 text-fog hover:border-white/40 hover:text-white"}`}>
            {x === "Recharge" ? "⚡ Recharge points" : x}
          </button>
        ))}
      </div>
      <motion.ul layout className={`grid gap-3 sm:grid-cols-2 ${compact ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        <AnimatePresence mode="popLayout">
          {list.map((b) => (
            <motion.li layout key={b.id} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.35 }}
              className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-br p-6 ${b.kind === "recharge" ? "border-gold/50 from-gold/15 to-transparent" : tone[b.category]} ${["vr", "git-escape"].includes(b.id) && f === "All" ? "sm:col-span-2" : ""}`}>
              <div className="flex items-start justify-between gap-3"><span className={`${mono} text-fog`}>{b.kind === "recharge" ? "Recharge point" : b.category}{b.optional ? " · optional" : ""}</span><Price b={b} /></div>
              <div>
                <h3 className="mt-10 text-[26px] leading-[1.05] transition group-hover:text-gold">{b.name}</h3>
                <p className="mt-2 text-sm text-fog">{b.blurb}</p>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      <p className="mt-6 text-sm text-fog/80">Only the {EPOCH.currency} prices for VR (40) and recharge points (20) come from the original plan; the rest are placeholders until finalised.</p>
    </div>
  );
}
