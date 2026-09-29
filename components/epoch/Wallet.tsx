"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { animate } from "motion/react";
import { Frame, Notice } from "./Frame";
import { Coin, btnInk, btnSoft, glass, label } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";
import type { Tx } from "@/lib/epoch/types";

function Balance({ value }: { value: number }) {
  const [n, setN] = useState(value);
  useEffect(() => { const c = animate(n, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) }); return () => c.stop(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  return <>{n}</>;
}

export function Wallet() {
  const { store, me, ready, refresh } = useEpoch(); const router = useRouter();
  const [tx, setTx] = useState<Tx[]>([]);

  useEffect(() => { if (store && me) store.history().then(setTx); }, [store, me]);
  useEffect(() => { if (!me) return; const i = setInterval(() => void refresh(), 4000); return () => clearInterval(i); }, [me, refresh]); // near-real-time balance

  if (!ready) return <Frame title="Wallet"><div className="h-64" /></Frame>;
  if (!me) return <Frame title="No wallet yet." sub="Create a profile to get your pass and QR code."><Link href="/epoch/register" className={btnInk}>Get your ticket</Link></Frame>;

  const used = new Set(tx.filter((t) => t.ref.startsWith("booth:recharge-")).map((t) => t.ref.slice(6)));
  const left = RECHARGE_POINTS.filter((p) => !used.has(p.id)).length;

  return (
    <Frame title={`Hi, ${me.name.split(" ")[0]}.`} aside={<button className={btnSoft} onClick={async () => { await store?.signOut(); await refresh(); router.push("/epoch"); }}>Sign out</button>}>
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <section className={`${glass} p-8 sm:p-10`}>
          <div className="flex items-center justify-between">
            <span className={label}>@{me.handle}</span>
            <span className={`rounded-full px-3.5 py-1 text-[13px] ${me.ticket ? "bg-ink text-white" : "bg-ink/[.07] text-mute"}`}>{me.ticket ? "Ticket verified" : "Ticket pending"}</span>
          </div>
          <p className={`${label} mt-12`}>Balance</p>
          <p className="flex items-center gap-4 text-[clamp(72px,13vw,150px)] font-medium leading-none tracking-[-0.06em]"><Coin size={64} /><Balance value={me.coins} /></p>
        </section>
        <section className={`${glass} flex flex-col items-center justify-center gap-3 p-8`}>
          <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={qr.user(me.id)} size={160} level="M" /></div>
          <p className={`${label} text-center`}>Show at the desk</p>
        </section>
      </div>

      {!me.ticket && (
        <div className="mt-4"><Notice kind="info">
          One step left: pay your ₹{EPOCH.ticketPriceINR} ticket{EPOCH.ticketUrl ? <> <a className="underline" href={EPOCH.ticketUrl} target="_blank" rel="noopener">here</a></> : " at the registration desk"} and show the QR. {STARTER_COINS} {EPOCH.currency} appear here within seconds.
        </Notice></div>
      )}

      <section className="mt-16">
        <div className="mb-5 flex items-baseline justify-between"><h2 className="text-[28px] font-medium tracking-[-0.03em]">Recharge points</h2><span className={label}>{left} of {RECHARGE_POINTS.length} left</span></div>
        <ul className="flex flex-wrap gap-2.5">
          {RECHARGE_POINTS.map((p) => (
            <li key={p.id} className={`rounded-full border px-5 py-2.5 text-[15px] ${used.has(p.id) ? "border-hair text-mute line-through" : "border-ink/25 bg-white/60"}`}>{p.name} {used.has(p.id) ? "" : `· +${p.coins}`}</li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="mb-5 text-[28px] font-medium tracking-[-0.03em]">Ledger</h2>
        <ul className="border-t border-hair">
          {tx.length === 0 && <li className="py-5 text-mute">Nothing yet.</li>}
          {tx.map((t) => (
            <li key={t.id} className="flex items-baseline justify-between gap-6 border-b border-hair py-4">
              <div className="min-w-0"><p className="truncate text-[17px]">{t.reason}</p><p className="text-sm text-mute">{new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
              <span className={`text-[19px] font-medium tabular-nums ${t.delta > 0 ? "" : "text-mute"}`}>{t.delta > 0 ? "+" : "−"}{Math.abs(t.delta)}</span>
            </li>
          ))}
        </ul>
      </section>
    </Frame>
  );
}
