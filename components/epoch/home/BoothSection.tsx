"use client";
import { useState } from "react";
import { NodeIcon } from "@/components/ui/GitGraph";
import { BoothIndex, inFilter, type Filter } from "./BoothIndex";
import { BOOTHS, BOOTH_COUNT } from "@/lib/epoch/config";
import type { NodeColor, Shape } from "@/lib/config";

/* Teampaper / hire{dev} mood: playful colour-block cards, thick outlines, hard offset shadows.
   They double as filters for the clean index underneath. */
const CATS: { f: Exclude<Filter, "All">; bg: string; shape: Shape; color: NodeColor }[] = [
  { f: "Recharge", bg: "#ffd34d", shape: "triangle", color: "green" },
  { f: "Play", bg: "#cdb8f7", shape: "diamond", color: "purple" },
  { f: "Make", bg: "#a9e8cf", shape: "ring", color: "mint" },
  { f: "Explore", bg: "#bfe0f7", shape: "square", color: "blue" },
  { f: "Compete", bg: "#ffcdb5", shape: "diamond", color: "blue" },
];

export function BoothSection() {
  const [f, setF] = useState<Filter>("All");
  return (
    <div>
      <ul className="mb-14 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {CATS.map((c) => {
          const items = BOOTHS.filter((b) => inFilter(b, c.f)); const on = f === c.f;
          return (
            <li key={c.f}>
              <button onClick={() => setF(on ? "All" : c.f)} aria-pressed={on} style={{ background: c.bg }}
                className={`flex h-full min-h-[230px] w-full flex-col rounded-[28px] border-2 border-ink p-5 text-left transition-all duration-200 ${on ? "translate-x-[5px] translate-y-[5px] shadow-[1px_1px_0_#0b0b0f]" : "shadow-[6px_6px_0_#0b0b0f] hover:-translate-y-1 hover:shadow-[9px_9px_0_#0b0b0f]"}`}>
                <NodeIcon shape={c.shape} color={c.color} size={40} />
                <span className="mt-auto block text-[52px] font-medium leading-none tracking-[-0.06em]">{items.length}</span>
                <span className="mt-1 block text-[20px] font-medium tracking-[-0.02em]">{c.f === "Recharge" ? "Recharge points" : c.f}</span>
                <span className="mt-2 block text-[13px] leading-snug text-ink/70">{items.slice(0, 3).map((b) => b.name.replace(" Point", "")).join(" · ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mb-8 text-[15px] text-mute">{BOOTH_COUNT} booths &amp; experiences in total. Tap a card to filter.</p>
      <BoothIndex value={f} onChange={setF} />
    </div>
  );
}
