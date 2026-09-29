"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnEpoch, btnInk, mono } from "./Bits";
import { Scanner } from "./Scanner";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import type { Profile } from "@/lib/epoch/types";

type Outcome = { ok: true; title: string; delta?: number; balance?: number } | { ok: false; error: string };

export function ScanPage() {
  const { store, me, ready, refresh } = useEpoch();
  const [out, setOut] = useState<Outcome | null>(null);
  const [target, setTarget] = useState<Profile | null>(null); // staff: attendee being awarded
  const [amount, setAmount] = useState(25); const [reason, setReason] = useState("");
  const [manual, setManual] = useState(""); const [busy, setBusy] = useState(false);
  const staff = !!me && me.role !== "attendee";

  const handle = async (text: string) => {
    if (busy || !store) return; const p = qr.parse(text);
    if (!p) return setOut({ ok: false, error: "That isn't an Epoch QR code." });
    setBusy(true);
    if (p.kind === "stall") {
      const r = await store.scanStall(p.id);
      setOut(r.ok ? { ok: true, title: r.stall.name, delta: r.delta, balance: r.balance } : r); if (r.ok) void refresh();
    } else if (staff) {
      const u = await store.lookup(p.id); if (u) setTarget(u); else setOut({ ok: false, error: "Unknown attendee." });
    } else setOut({ ok: false, error: "That's another attendee's wallet — only organisers can scan those." });
    setBusy(false);
  };

  const award = async () => {
    if (!store || !target) return; setBusy(true);
    const r = await store.award(target.id, amount, reason);
    setBusy(false);
    setOut(r.ok ? { ok: true, title: `@${r.profile.handle}`, delta: amount, balance: r.profile.coins } : r); setTarget(null); setReason("");
  };

  if (ready && !me) return <Frame kicker="// scan" title="Sign up first."><div className="p-6 sm:p-10"><Link href="/epoch/register" className={btnEpoch}>Register ↗</Link></div></Frame>;

  return (
    <Frame kicker={staff ? "// scan · organiser" : "// scan"} title={<>Scan a <span className="text-epoch-line">stall</span>.</>}>
      <div className="grid md:grid-cols-2">
        <div className="space-y-5 border-b border-epoch-line/70 p-6 sm:p-10 md:border-b-0 md:border-r">
          <Scanner onCode={handle} paused={busy || !!out || !!target} />
          <form onSubmit={(e) => { e.preventDefault(); void handle(manual.trim()); setManual(""); }} className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="or paste a code: epoch:s:git-quiz" className="min-w-0 flex-1 rounded-md border-2 border-ink/15 px-4 py-3 font-mono text-sm outline-none focus:border-epoch-line" />
            <button className={btnInk}>Go</button>
          </form>
        </div>

        <div className="p-6 sm:p-10">
          {!out && !target && (
            <div className="space-y-4 text-ink-2">
              <p className={`${mono} text-epoch-line`}>How it works</p>
              <p className="text-lg">Point your camera at the QR on a stall table. Earn stalls pay you; spend stalls charge you. Each stall works once per person.</p>
              {staff && <Notice kind="info">Organiser mode: scan an attendee&apos;s wallet QR to award or deduct coins.</Notice>}
            </div>
          )}
          <AnimatePresence mode="wait">
            {out && (
              <motion.div key="out" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`rounded-[18px] border-2 border-ink p-8 text-center ${out.ok ? "bg-epoch" : "bg-red-100"}`}>
                {out.ok ? (<>
                  <motion.div initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="mx-auto w-fit"><Coin size={96} /></motion.div>
                  <p className="mt-4 font-display text-6xl font-black tracking-tighter">{out.delta! > 0 ? "+" : ""}{out.delta}</p>
                  <p className="mt-2 text-lg font-semibold">{out.title}</p>
                  <p className={`${mono} mt-1 text-ink-2`}>Balance {out.balance}</p>
                </>) : (<><p className="text-5xl">⚠️</p><p className="mt-3 text-lg font-semibold text-red-800">{out.error}</p></>)}
                <button onClick={() => setOut(null)} className={`${btnInk} mt-6`}>Scan another</button>
              </motion.div>
            )}
            {target && (
              <motion.div key="t" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 rounded-[18px] border-2 border-ink p-6">
                <div><p className={`${mono} text-epoch-line`}>Attendee</p><p className="font-display text-3xl font-black">{target.name}</p><p className="font-mono text-sm text-ink-3">@{target.handle} · {target.coins} coins</p></div>
                <div className="flex gap-2">{[10, 25, 50, 100].map((n) => <button key={n} onClick={() => setAmount(n)} className={`flex-1 rounded-md border-2 py-2 font-mono text-sm font-bold ${amount === n ? "border-ink bg-epoch" : "border-ink/15"}`}>+{n}</button>)}</div>
                <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="w-full rounded-md border-2 border-ink/15 px-4 py-3 font-mono outline-none focus:border-epoch-line" aria-label="Coins (negative to deduct)" />
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. Won the CTF)" className="w-full rounded-md border-2 border-ink/15 px-4 py-3 outline-none focus:border-epoch-line" />
                <div className="flex gap-2"><button disabled={busy || !amount} onClick={award} className={`${btnEpoch} flex-1`}>{amount >= 0 ? "Award" : "Deduct"} {Math.abs(amount)} ↗</button><button onClick={() => setTarget(null)} className={btnInk}>Cancel</button></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Frame>
  );
}
