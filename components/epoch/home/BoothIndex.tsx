"use client";
import { useState } from "react";
import { BOOTHS } from "@/lib/epoch/config";
import type { Booth } from "@/lib/epoch/types";

export const FILTERS = ["All", "Recharge", "Play", "Make", "Explore", "Compete"] as const;
export type Filter = (typeof FILTERS)[number];
export const inFilter = (b: Booth, f: Filter) => (f === "All" ? true : f === "Recharge" ? b.kind === "recharge" : b.kind !== "recharge" && b.category === f);

function Price({ b }: { b: Booth }) {
  if (b.kind === "free") return <span className="text-mute">Free</span>;
  if (b.kind === "recharge") return <span className="font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold align-middle" />+{b.coins} once</span>;
  return <span>−{b.coins}<span className="text-mute"> / session</span></span>;
}

/* An index, not a grid of cards: name, one quiet line, price. Controlled or self-managed. */
export function BoothIndex({ value, onChange }: { value?: Filter; onChange?: (f: Filter) => void }) {
  const [own, setOwn] = useState<Filter>("All");
  const f = value ?? own; const set = onChange ?? setOwn;
  const list = BOOTHS.filter((b) => inFilter(b, f));
  return (
    <div>
      <div role="tablist" aria-label="Filter booths" className="mb-8 flex flex-wrap gap-x-7 gap-y-2 text-[17px]">
        {FILTERS.map((x) => (
          <button key={x} role="tab" aria-selected={f === x} onClick={() => set(x)} className={`border-b-2 pb-1 transition ${f === x ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`}>{x === "Recharge" ? "Recharge points" : x}</button>
        ))}
      </div>
      <ul className="border-t border-hair">
        {list.map((b) => (
          <li key={b.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 border-b border-hair py-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_150px]">
            <h3 className="text-[21px] font-medium tracking-[-0.02em]">{b.name}{b.optional && <span className="ml-2 text-sm font-normal text-mute">optional</span>}</h3>
            <p className="order-3 col-span-2 text-[15px] text-mute sm:order-none sm:col-span-1">{b.blurb}</p>
            <span className="text-right text-[17px]"><Price b={b} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
