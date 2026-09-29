"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { animate } from "motion/react";
import { Frame, Notice } from "./Frame";
import { Coin, btnGhost, btnGold, card, mono } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";
import type { Tx } from "@/lib/epoch/types";

function Balance({ value }: { value: number }) {
  const [n, setN] = useState(value);
  useEffect(() => { const c = animate(n, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) }); return () => c.stop(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  return <>{n}</>;
}
const shortHash = (id: string) => id.replace(/[^a-z0-9]/gi, "").slice(0, 7).padEnd(7, "0");

export function Wallet() {
  const { store, me, ready, refresh } = useEpoch(); const router = useRouter();
  const [tx, setTx] = useState<Tx[]>([]);

  useEffect(() => { if (store && me) store.history().then(setTx); }, [store, me]);
  useEffect(() => { if (!me) return; const i = setInterval(() => void refresh(), 4000); return () => clearInterval(i); }, [me, refresh]); // near-real-time balance

  if (!ready) return <Frame kicker="// wallet" title="Loading…"><div className="h-64" /></Frame>;
  if (!me) return (
    <Frame kicker="// wallet" title="No wallet yet.">
      <p className="mb-6 max-w-[50ch] text-lg text-fog">Create a profile to get your pass and QR code.</p><Link href="/epoch/register" className={btnGold}>Get your ticket →</Link>
    </Frame>
  );

  const used = new Set(tx.filter((t) => t.ref.startsWith("booth:recharge-")).map((t) => t.ref.slice(6)));
  const left = RECHARGE_POINTS.filter((p) => !used.has(p.id)).length;

  return (
    <Frame kicker="// wallet" title={<>Hey, {me.name.split(" ")[0]}.</>} aside={<button className={btnGhost} onClick={async () => { await store?.signOut(); await refresh(); router.push("/epoch"); }}>Sign out</button>}>
      {/* boarding-pass style ticket */}
      <div className="relative grid overflow-hidden rounded-[2rem] bg-gradient-to-br from-gold via-[#ffd75e] to-[#ffb300] text-night shadow-[0_40px_100px_-30px_rgba(255,201,51,.45)] md:grid-cols-[1fr_auto]">
        <div className="p-7 sm:p-10">
          <div className="flex items-center justify-between"><span className={`${mono} font-bold`}>epoch_{EPOCH.edition} · attendee</span><span className={`${mono} rounded-full px-3 py-1 font-bold ${me.ticket ? "bg-night text-gold" : "bg-night/15"}`}>{me.ticket ? "✓ ticket verified" : "ticket pending"}</span></div>
          <p className="mt-10 font-display text-4xl font-black tracking-tight sm:text-5xl">{me.name}</p>
          <p className="font-mono text-sm opacity-70">@{me.handle}</p>
          <div className="mt-10"><p className={`${mono} opacity-70`}>Balance</p>
            <p className="flex items-center gap-3 font-display text-[clamp(64px,12vw,140px)] font-black leading-none tracking-tighter"><Coin size={72} /><Balance value={me.coins} /></p></div>
        </div>
        <div className="relative flex flex-col items-center justify-center gap-3 border-t-2 border-dashed border-night/40 p-7 md:border-l-2 md:border-t-0">
          <span aria-hidden className="absolute -top-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-night md:-left-4 md:top-4 md:translate-x-0" />
          <span aria-hidden className="absolute -bottom-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-night md:-left-4 md:bottom-4 md:top-auto md:translate-x-0" />
          <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={qr.user(me.id)} size={168} level="M" /></div>
          <p className={`${mono} text-center opacity-70`}>Show at desk &amp; stalls</p>
        </div>
      </div>

      {!me.ticket && (
        <div className="mt-4"><Notice kind="info">
          <b className="text-white">One step left.</b> Pay your ₹{EPOCH.ticketPriceINR} ticket{EPOCH.ticketUrl ? <> <a className="text-gold underline" href={EPOCH.ticketUrl} target="_blank" rel="noopener">via this link</a></> : " at the registration desk"}, then show the QR above. An organiser verifies it and {STARTER_COINS} {EPOCH.currency} appear here within seconds.
        </Notice></div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-7`}>
          <div className="mb-6 flex items-end justify-between"><h2 className="text-3xl">Recharge points</h2><span className={`${mono} text-gold`}>{left} of {RECHARGE_POINTS.length} left</span></div>
          <ul className="space-y-2.5">
            {RECHARGE_POINTS.map((p) => (
              <li key={p.id} className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${used.has(p.id) ? "border-edge opacity-50" : "border-gold/40 bg-gold/5"}`}>
                <span className="flex items-center gap-3"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${used.has(p.id) ? "bg-white/10 text-fog" : "bg-gold text-night"}`}>{used.has(p.id) ? "✓" : "⚡"}</span>{p.name}</span>
                <span className="font-mono text-sm text-gold">{used.has(p.id) ? "used" : `+${p.coins}`}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-fog">Each point can be used once per person.</p>
        </section>

        <section className={`${card} p-7`}>
          <div className="mb-6 flex items-end justify-between"><h2 className="text-3xl">Ledger</h2><span className={`${mono} text-fog`}>earned {me.earned}</span></div>
          <ul className="max-h-[420px] overflow-y-auto">
            {tx.length === 0 && <li className="text-fog">No transactions yet.</li>}
            {tx.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 border-b border-edge py-3.5 last:border-0">
                <div className="min-w-0"><p className="truncate font-medium">{t.reason}</p><p className="font-mono text-xs text-fog"><span className="text-gold/80">{shortHash(t.id)}</span> · {new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
                <span className={`font-mono text-lg font-bold ${t.delta > 0 ? "text-mint" : "text-fog"}`} style={t.delta > 0 ? { color: "#4fd1a1" } : undefined}>{t.delta > 0 ? "+" : ""}{t.delta}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Frame>
  );
}
