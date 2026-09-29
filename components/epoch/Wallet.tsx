"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Suspense, useEffect, useState } from "react";
import { animate } from "motion/react";
import { Frame } from "./Frame";
import { Coin, btnEpoch, btnInk, mono } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { EPOCH } from "@/lib/epoch/config";
import type { Tx } from "@/lib/epoch/types";

function Balance({ value }: { value: number }) {
  const [n, setN] = useState(value);
  useEffect(() => { const c = animate(n, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) }); return () => c.stop(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  return <>{n}</>;
}

function WalletInner() {
  const { store, me, ready, refresh } = useEpoch(); const router = useRouter(); const welcome = useSearchParams().get("welcome");
  const [tx, setTx] = useState<Tx[]>([]);
  useEffect(() => { if (store && me) store.history().then(setTx); }, [store, me]);

  if (!ready) return <Frame kicker="// wallet" title="Loading…"><div className="h-64" /></Frame>;
  if (!me) return (
    <Frame kicker="// wallet" title="No wallet yet.">
      <div className="p-6 sm:p-10"><p className="mb-6 max-w-[50ch] text-lg text-ink-2">Register to get your pass, your QR code and {EPOCH.welcomeCoins} {EPOCH.currency}.</p><Link href="/epoch/register" className={btnEpoch}>Register ↗</Link></div>
    </Frame>
  );

  return (
    <Frame kicker="// wallet" title={<>Hey, {me.name.split(" ")[0]}.</>} aside={<button className={btnInk} onClick={async () => { await store?.signOut(); await refresh(); router.push("/epoch"); }}>Sign out</button>}>
      {welcome && <p className="border-b border-epoch-line/70 bg-epoch px-6 py-3 font-mono text-[13px] uppercase tracking-[0.14em] sm:px-10">🎉 Welcome aboard — {EPOCH.welcomeCoins} {EPOCH.currency} landed in your wallet.</p>}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="border-b border-epoch-line/70 p-6 sm:p-10 lg:border-b-0 lg:border-r">
          {/* the pass */}
          <div className="relative mx-auto max-w-[420px] overflow-hidden rounded-[22px] bg-epoch-night p-7 text-white shadow-[0_40px_80px_-30px_rgba(31,138,59,.6)]">
            <div className="absolute -right-10 -top-10 opacity-20"><Coin size={220} /></div>
            <p className={`${mono} text-epoch`}>Epoch&apos;{EPOCH.edition} · attendee</p>
            <p className="mt-6 font-display text-3xl font-black tracking-tight">{me.name}</p>
            <p className="font-mono text-sm text-[#a9b3ad]">@{me.handle}</p>
            <div className="mx-auto my-7 w-fit rounded-2xl bg-white p-4"><QRCodeSVG value={qr.user(me.id)} size={190} level="M" /></div>
            <p className={`${mono} text-center text-[#6b7a70]`}>Show this at stalls &amp; the desk</p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between border-b border-epoch-line/70 p-6 sm:p-10">
            <div><p className={`${mono} text-ink-3`}>Balance</p><p className="flex items-center gap-4 font-display text-[clamp(56px,9vw,120px)] font-black leading-none tracking-tighter"><Coin size={64} /><Balance value={me.coins} /></p></div>
            <div className="hidden text-right sm:block"><p className={`${mono} text-ink-3`}>Lifetime earned</p><p className="font-display text-4xl font-black">{me.earned}</p></div>
          </div>
          <div className="grid grid-cols-2 border-b border-epoch-line/70">
            <Link href="/epoch/scan" className="border-r border-epoch-line/70 bg-epoch p-6 text-center font-mono text-[13px] font-bold uppercase tracking-[0.14em] hover:brightness-95">Scan a stall ↗</Link>
            <Link href="/epoch/shop" className="p-6 text-center font-mono text-[13px] font-bold uppercase tracking-[0.14em] hover:bg-epoch/30">Open shop ↗</Link>
          </div>
          <h2 className={`${mono} border-b border-epoch-line/70 p-6 sm:px-10`}>Activity</h2>
          <ul>
            {tx.length === 0 && <li className="p-6 text-ink-3 sm:px-10">Nothing yet.</li>}
            {tx.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 border-b border-epoch-line/30 px-6 py-4 sm:px-10">
                <div><p className="font-semibold">{t.reason}</p><p className="font-mono text-xs text-ink-3">{new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
                <span className={`font-mono text-lg font-bold ${t.delta > 0 ? "text-epoch-line" : "text-ink-2"}`}>{t.delta > 0 ? "+" : ""}{t.delta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

export function Wallet() { return <Suspense><WalletInner /></Suspense>; }
