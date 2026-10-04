"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnInk, field, glass, label } from "./Bits";
import { Scanner } from "./Scanner";
import { AttendeeSearch, StaffPanel, postLine, type Outcome } from "./Staff";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { STARTER_COINS, EPOCH } from "@/lib/epoch/config";
import type { Profile } from "@/lib/epoch/types";

export function ScanPage() {
  const { store, me, ready, refresh } = useEpoch();
  const [out, setOut] = useState<Outcome | null>(null);
  const [target, setTarget] = useState<Profile | null>(null); // staff: attendee being served
  const [manual, setManual] = useState(""); const [busy, setBusy] = useState(false);
  const staff = !!me && me.role !== "attendee";

  // from the desk's attendee search: /epoch/scan?u=<id> opens that person straight away
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("u");
    if (!store || !staff || !id) return;
    store.lookup(id).then((u) => { if (u) setTarget(u); });
  }, [store, staff]);

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
  const done = (o: Outcome) => { setOut(o); setTarget(null); void refresh(); };

  if (ready && !me) return <Frame title="Sign up first."><Link href="/epoch/register" className={btnInk}>Get your ticket</Link></Frame>;

  return (
    <Frame title="Scan a booth." sub={staff && me ? postLine(me) : "Point your camera at the QR on a booth."}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Scanner onCode={handle} paused={busy || !!out || !!target} />
          <form onSubmit={(e) => { e.preventDefault(); void handle(manual.trim()); setManual(""); }} className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="or paste a code, e.g. epoch:b:vr" aria-label="Epoch code" className={`${field} !py-3 !text-[15px]`} />
            <button className={btnInk}>Go</button>
          </form>
          {staff && !target && <div className={`${glass} p-5`}><AttendeeSearch onPick={(p) => { setOut(null); setTarget(p); }} /></div>}
        </div>

        <div className={`${glass} p-8 sm:p-10`}>
          {!out && !target && (
            <div className="space-y-4 text-[17px] text-mute">
              <p><b className="font-medium text-ink">Recharge points</b> pay you coins, once each. <b className="font-medium text-ink">Spend booths</b> charge a few coins per session.</p>
              {me && !me.ticket && !staff && <Notice kind="info">Your ticket isn&apos;t verified yet — pay at the registration desk and show your wallet QR there first.</Notice>}
              {staff && <Notice kind="info">Scan an attendee&apos;s wallet QR. Verifying a ticket credits {STARTER_COINS} {EPOCH.currency}, once.</Notice>}
              <p className="text-[15px]">Something wrong? <Link href="/epoch/guide" className="text-ink underline underline-offset-2">What to do</Link></p>
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
              <motion.div key="t" initial={{ opacity: 0, transform: "translateY(12px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }}>
                <StaffPanel key={target.id} target={target} onClose={() => setTarget(null)} onResult={done} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Frame>
  );
}
