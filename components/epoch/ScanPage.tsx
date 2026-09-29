"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnGhost, btnGold, card, field, mono } from "./Bits";
import { Scanner } from "./Scanner";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";
import type { Profile } from "@/lib/epoch/types";

type Outcome = { ok: true; title: string; delta: number; balance: number } | { ok: false; error: string };

export function ScanPage() {
  const { store, me, ready, refresh } = useEpoch();
  const [out, setOut] = useState<Outcome | null>(null);
  const [target, setTarget] = useState<Profile | null>(null); // staff: attendee being served
  const [amount, setAmount] = useState(25); const [reason, setReason] = useState("");
  const [manual, setManual] = useState(""); const [busy, setBusy] = useState(false);
  const staff = !!me && me.role !== "attendee";

  const handle = async (text: string) => {
    if (busy || !store) return; const p = qr.parse(text);
    if (!p) return setOut({ ok: false, error: "That isn't an Epoch QR code." });
    setBusy(true);
    if (p.kind === "booth") {
      const r = await store.scanBooth(p.id);
      setOut(r.ok ? { ok: true, title: r.booth.name, delta: r.delta, balance: r.balance } : r); if (r.ok) void refresh();
    } else if (staff) {
      const u = await store.lookup(p.id); if (u) setTarget(u); else setOut({ ok: false, error: "Unknown attendee." });
    } else setOut({ ok: false, error: "That's another attendee's wallet — only organisers scan those." });
    setBusy(false);
  };

  const verify = async () => {
    if (!store || !target) return; setBusy(true);
    const r = await store.issueTicket(target.id); setBusy(false);
    setOut(r.ok ? { ok: true, title: `Ticket verified · @${r.profile.handle}`, delta: STARTER_COINS, balance: r.profile.coins } : r); setTarget(null);
  };
  const award = async () => {
    if (!store || !target) return; setBusy(true);
    const r = await store.award(target.id, amount, reason); setBusy(false);
    setOut(r.ok ? { ok: true, title: `@${r.profile.handle}`, delta: amount, balance: r.profile.coins } : r); setTarget(null); setReason("");
  };

  if (ready && !me) return <Frame kicker="// scan" title="Sign up first."><Link href="/epoch/register" className={btnGold}>Get your ticket →</Link></Frame>;

  return (
    <Frame kicker={staff ? "// scan · organiser" : "// scan"} title={<>Scan a <span className="text-gold">booth</span>.</>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Scanner onCode={handle} paused={busy || !!out || !!target} />
          <form onSubmit={(e) => { e.preventDefault(); void handle(manual.trim()); setManual(""); }} className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="or paste a code: epoch:b:vr" className={`${field} !py-3 font-mono !text-sm`} />
            <button className={btnGold}>Go</button>
          </form>
        </div>

        <div className={`${card} p-7 sm:p-9`}>
          {!out && !target && (
            <div className="space-y-4 text-fog">
              <p className={`${mono} text-gold`}>How it works</p>
              <p className="text-lg">Point your camera at the QR on a booth. <b className="text-white">Recharge points</b> pay you coins — once each. <b className="text-white">Spend booths</b> charge a few coins per session.</p>
              {me && !me.ticket && !staff && <Notice kind="info">Your ticket isn&apos;t verified yet — show your wallet QR at the desk first.</Notice>}
              {staff && <Notice kind="info">Organiser mode: scan an attendee&apos;s wallet QR to verify their ticket ({STARTER_COINS} {EPOCH.currency}) or award/deduct coins.</Notice>}
            </div>
          )}
          <AnimatePresence mode="wait">
            {out && (
              <motion.div key="out" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
                {out.ok ? (<>
                  <motion.div initial={{ rotateY: 180, scale: 0 }} animate={{ rotateY: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 12 }} className="mx-auto w-fit"><Coin size={110} /></motion.div>
                  <p className={`mt-4 font-display text-7xl font-black tracking-tighter ${out.delta > 0 ? "text-gold" : "text-white"}`}>{out.delta > 0 ? "+" : ""}{out.delta}</p>
                  <p className="mt-2 text-xl font-semibold">{out.title}</p>
                  <p className={`${mono} mt-1 text-fog`}>New balance {out.balance}</p>
                </>) : (<><p className="text-5xl">⚠️</p><p className="mx-auto mt-3 max-w-[32ch] text-lg text-red-200">{out.error}</p></>)}
                <button onClick={() => setOut(null)} className={`${btnGold} mt-7`}>Scan another</button>
              </motion.div>
            )}
            {target && (
              <motion.div key="t" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div><p className={`${mono} text-gold`}>Attendee</p><p className="font-display text-4xl font-black tracking-tight">{target.name}</p><p className="font-mono text-sm text-fog">@{target.handle} · {target.coins} coins · ticket {target.ticket ? "verified" : "pending"}</p></div>
                {!target.ticket && <button disabled={busy} onClick={verify} className={`${btnGold} w-full !py-4`}>Verify ticket → +{STARTER_COINS} {EPOCH.currency}</button>}
                <div className="space-y-3 rounded-2xl border border-edge p-4">
                  <p className={`${mono} text-fog`}>Manual award / deduct</p>
                  <div className="flex gap-2">{[10, 20, 50, 100].map((n) => <button key={n} onClick={() => setAmount(n)} className={`flex-1 rounded-full border py-2 font-mono text-sm font-bold ${amount === n ? "border-gold bg-gold text-night" : "border-white/15 text-fog"}`}>+{n}</button>)}</div>
                  <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className={`${field} !py-3 font-mono`} aria-label="Coins (negative to deduct)" />
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. Fail-Proof Code winner)" className={`${field} !py-3`} />
                  <button disabled={busy || !amount} onClick={award} className={`${btnGhost} w-full`}>{amount >= 0 ? "Award" : "Deduct"} {Math.abs(amount)}</button>
                </div>
                <button onClick={() => setTarget(null)} className="text-sm text-fog underline">Cancel</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Frame>
  );
}
