"use client";
import { useEffect, useRef } from "react";
import { XIcon } from "@primer/octicons-react";
import { Coin } from "./Bits";
import { EPOCH } from "@/lib/epoch/config";
import { itemName, kindLabel, place, shortRef } from "@/lib/epoch/receipt";
import type { Tx } from "@/lib/epoch/types";

/* One transaction as a paper receipt: what, where, when, how much, the balance right after, and a short
   reference to read out at the desk. Built from the wallet's own copy, so it opens offline too. */
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function Receipt({ tx, all, onClose }: { tx: (Tx & { after: number }) | null; all: Tx[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (tx && d && !d.open) d.showModal(); if (!tx && d?.open) d.close(); }, [tx]);
  const undone = tx?.reverses ? all.find((t) => t.id === tx.reverses) : undefined;
  const undoneBy = tx?.reversedAt ? all.find((t) => t.reverses === tx.id) : undefined;
  const item = tx && itemName(tx);
  const row = (k: string, v: React.ReactNode) => <div className="flex justify-between gap-4 py-2"><dt className="text-mute">{k}</dt><dd className="min-w-0 text-right">{v}</dd></div>;

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} aria-labelledby="receipt-h"
      className="m-auto w-[min(420px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-visible bg-transparent p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]">
      {tx && (
        <div className="relative max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[18px] bg-[#fffdf7] p-6 font-mono text-[14px] shadow-[0_30px_60px_-30px_rgba(11,11,15,.6)]">
          <button onClick={() => ref.current?.close()} aria-label="Close receipt" className="absolute right-3 top-3 rounded-full p-2 text-mute hover:bg-ink/[.05] hover:text-ink"><XIcon size={18} /></button>
          <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em] text-mute"><Coin size={18} />{EPOCH.name} receipt</p>
          <h2 id="receipt-h" className="mt-3 font-epoch text-[24px] font-medium leading-tight tracking-[-0.03em]">{tx.reason}</h2>
          <p className={`mt-3 text-[40px] font-bold leading-none tabular-nums tracking-[-0.04em] ${tx.reversedAt ? "text-mute line-through" : ""}`}>{tx.delta > 0 ? "+" : "−"}{Math.abs(tx.delta)} <span className="text-[16px] font-normal tracking-normal text-mute">{EPOCH.currency}</span></p>
          <dl className="mt-5 divide-y divide-dashed divide-ink/15 border-y border-dashed border-ink/15">
            {row("Type", kindLabel(tx))}
            {row("Where", place(tx))}
            {row("When", when(tx.at))}
            {row("Balance after", <span className="font-bold">{tx.after} {EPOCH.currency}</span>)}
            {row("Reference", <span className="font-bold tracking-[0.06em]">{shortRef(tx.id)}</span>)}
          </dl>
          {undone && <p className="mt-4 text-[13px] text-mute">This undoes {shortRef(undone.id)} ({undone.reason}).</p>}
          {tx.reversedAt && <p className="mt-4 rounded-xl bg-ink/[.05] px-3 py-2 text-[13px]">Reversed by an organiser{undoneBy ? ` (${shortRef(undoneBy.id)})` : ""}. {tx.delta < 0 ? "The coins went back to you." : "The coins came off your balance."}</p>}
          {item && !tx.reversedAt && <p className="mt-4 text-[13px]">Show this at the Merchandise Stall to collect your {item}.</p>}
          <p className="mt-4 text-[12px] leading-relaxed text-mute">Something wrong? Show this receipt to the booth&apos;s volunteer or at the registration desk.</p>
        </div>
      )}
    </dialog>
  );
}
