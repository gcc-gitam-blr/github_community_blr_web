"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnInk, btnSoft, field, glass, label } from "./Bits";
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

  if (ready && !me) return <Frame title="Sign up first."><Link href="/epoch/register" className={btnInk}>Get your ticket</Link></Frame>;

  return (
    <Frame title="Scan a booth." sub={staff ? "Organiser mode: scan a wallet to verify a ticket or award coins." : "Point your camera at the QR on a booth."}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Scanner onCode={handle} paused={busy || !!out || !!target} />
          <form onSubmit={(e) => { e.preventDefault(); void handle(manual.trim()); setManual(""); }} className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="or paste a code, e.g. epoch:b:vr" className={`${field} !py-3 !text-[15px]`} />
            <button className={btnInk}>Go</button>
          </form>
        </div>

        <div className={`${glass} p-8 sm:p-10`}>
          {!out && !target && (
            <div className="space-y-4 text-[17px] text-mute">
              <p><b className="font-medium text-ink">Recharge points</b> pay you coins, once each. <b className="font-medium text-ink">Spend booths</b> charge a few coins per session.</p>
              {me && !me.ticket && !staff && <Notice kind="info">Your ticket isn&apos;t verified yet — show your wallet QR at the desk first.</Notice>}
              {staff && <Notice kind="info">Verifying a ticket credits {STARTER_COINS} {EPOCH.currency}, once.</Notice>}
            </div>
          )}
          <AnimatePresence mode="wait">
            {out && (
              <motion.div key="out" initial={{ opacity: 0, transform: "scale(0.96)" }} animate={{ opacity: 1, transform: "scale(1)" }} exit={{ opacity: 0 }} className="text-center">
                {out.ok ? (<>
                  <motion.div initial={{ transform: "rotateY(180deg) scale(0.5)", opacity: 0 }} animate={{ transform: "rotateY(0deg) scale(1)", opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 13 }} className="mx-auto w-fit"><Coin size={88} /></motion.div>
                  <p className="mt-5 text-[80px] font-medium leading-none tracking-[-0.06em]">{out.delta > 0 ? "+" : "−"}{Math.abs(out.delta)}</p>
                  <p className="mt-3 text-[19px]">{out.title}</p>
                  <p className={`${label} mt-1`}>New balance {out.balance}</p>
                </>) : <p className="mx-auto max-w-[30ch] text-[19px] text-red-800">{out.error}</p>}
                <button onClick={() => setOut(null)} className={`${btnInk} mt-8`}>Scan another</button>
              </motion.div>
            )}
            {target && (
              <motion.div key="t" initial={{ opacity: 0, transform: "translateY(12px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} className="space-y-5">
                <div><p className="text-[32px] font-medium leading-tight tracking-[-0.03em]">{target.name}</p><p className={label}>@{target.handle} · {target.coins} coins · ticket {target.ticket ? "verified" : "pending"}</p></div>
                {!target.ticket && <button disabled={busy} onClick={verify} className={`${btnInk} w-full`}>Verify ticket · +{STARTER_COINS} {EPOCH.currency}</button>}
                <div className="space-y-3 border-t border-hair pt-5">
                  <p className={label}>Award or deduct</p>
                  <div className="flex gap-2">{[10, 20, 50, 100].map((n) => <button key={n} onClick={() => setAmount(n)} className={`flex-1 rounded-full border py-2 text-sm ${amount === n ? "border-ink bg-ink text-white" : "border-hair"}`}>+{n}</button>)}</div>
                  <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className={`${field} !py-3`} aria-label="Coins (negative to deduct)" />
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. Fail-Proof Code winner" className={`${field} !py-3`} />
                  <button disabled={busy || !amount} onClick={award} className={`${btnSoft} w-full`}>{amount >= 0 ? "Award" : "Deduct"} {Math.abs(amount)}</button>
                </div>
                <button onClick={() => setTarget(null)} className="text-sm text-mute underline">Cancel</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Frame>
  );
}
