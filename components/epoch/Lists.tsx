"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Frame, Notice } from "./Frame";
import { Coin, btnInk, btnSoft, field, glass, label } from "./Bits";
import { BoothSection } from "./home/BoothSection";
import { AuditLog, FindAttendee, Team } from "./Desk";
import { MyPost } from "./Staff";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { useLiveLeaderboard, type BoardLink } from "@/lib/epoch/live";
import { BOOTHS, STARTER_COINS, EPOCH } from "@/lib/epoch/config";
import type { Reward } from "@/lib/epoch/types";

import { atHandle } from "@/lib/handle";
export function BoothsPage() {
  return <Frame title="Where coins go." sub="Recharge points earn. Everything else spends."><BoothSection /></Frame>;
}

export function ShopPage() {
  const { store, me, refresh } = useEpoch(); const [items, setItems] = useState<Reward[]>([]);
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null); const [busy, setBusy] = useState("");
  const load = useCallback(() => store?.rewards().then(setItems), [store]);
  useEffect(() => { void load(); }, [load]);

  const buy = async (r: Reward) => {
    if (!store) return; setBusy(r.id); setMsg(null);
    const res = await store.redeem(r.id); setBusy("");
    if (res.ok) { setMsg({ k: "ok", t: `Bought ${r.name}. Show this screen at the Merchandise Stall.` }); await refresh(); void load(); } else setMsg({ k: "err", t: res.error });
  };

  return (
    <Frame title="Merch, in coins." aside={me ? <Link href="/epoch/wallet" className={`${btnSoft} !py-3`}><Coin size={18} />{me.coins}</Link> : <Link href="/epoch/register" className={btnInk}>Get ticket</Link>}>
      {msg && <div className="mb-6"><Notice kind={msg.k}>{msg.t}</Notice></div>}
      <ul className="border-t border-hair">
        {items.map((r) => {
          const afford = !!me && me.coins >= r.cost;
          return (
            <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 border-b border-hair py-6 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_80px_150px]">
              <div><h3 className="text-[24px] font-medium tracking-[-0.03em]">{r.name}</h3><p className={label}>{r.stock} left</p></div>
              <p className="order-3 col-span-2 text-[16px] text-mute sm:order-none sm:col-span-1">{r.blurb}</p>
              <span className="flex items-center gap-2 text-[19px]"><Coin size={18} />{r.cost}</span>
              <button disabled={!me || !afford || r.stock <= 0 || busy === r.id} onClick={() => buy(r)} className={afford ? btnInk : btnSoft}>
                {r.stock <= 0 ? "Sold out" : !me ? "Get a ticket" : afford ? (busy === r.id ? "Buying…" : "Buy") : `Need ${r.cost - me.coins} more`}
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

/** Whether the board is updating by itself, and when it last did. */
export function LinkState({ link, updatedAt, className = "" }: { link: BoardLink; updatedAt: number | null; className?: string }) {
  if (link === "connecting") return null;
  const at = updatedAt ? new Date(updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
  const [dot, text] = link === "live" ? ["bg-[#1a7f37] animate-pulse motion-reduce:animate-none", "Live"] : link === "polling" ? ["bg-[#9a6700]", "Updating every few seconds"] : ["bg-[#cf222e]", `Offline · last updated ${at}`];
  return <p role="status" className={`inline-flex items-center gap-2 text-[13px] text-mute ${className}`}><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />{text}</p>;
}

export function LeaderboardPage() {
  const { me } = useEpoch(); const { rows, link, updatedAt } = useLiveLeaderboard(50);
  const still = useReducedMotion();
  return (
    <Frame title="Top earners." sub="Ranked by coins earned at recharge points and prizes. Spending never lowers your rank." aside={<LinkState link={link} updatedAt={updatedAt} />}>
      {rows?.length === 0 && <p className="text-[19px] text-mute">Nobody has earned coins yet. <Link className="text-ink underline" href="/epoch/register">Be first</Link>.</p>}
      <ol className="border-t border-hair">
        {rows?.map((r, i) => (
          <motion.li key={r.id} layout={!still} transition={{ type: "spring", stiffness: 420, damping: 38 }} className={`flex items-center gap-5 border-b border-hair py-5 ${me?.id === r.id ? "-mx-4 rounded-2xl bg-white/60 px-4" : ""}`}>
            <span className="w-8 text-[19px] tabular-nums text-mute">{i + 1}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-[24px] font-medium tracking-[-0.03em]">{r.name}</p><p className={`${label} truncate`}>{atHandle(r.handle)}{r.climbed > 0 && <span className="ml-2 text-[#1a7f37]">↑ {r.climbed}</span>}{r.gained > 0 && <span key={`${r.id}-${r.earned}`} className="ml-2 inline-block animate-[fade-out_4s_ease-out_forwards] rounded-full bg-[#dafbe1] px-2 tabular-nums text-[#1a7f37] motion-reduce:animate-none">+{r.gained}</span>}</p></div>
            <span className="flex items-center gap-2 text-[24px] font-medium tabular-nums"><Coin size={22} />{r.earned}</span>
          </motion.li>
        ))}
      </ol>
    </Frame>
  );
}

export function AdminPage() {
  const { store, me, ready, refresh } = useEpoch();
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  const staff = !!me && me.role !== "attendee";
  const printable = BOOTHS.filter((b) => b.kind !== "free");

  if (!ready) return <Frame title="Desk"><div className="h-64" /></Frame>;
  if (!me) return <Frame title="Sign in first."><Link href="/epoch/register" className={btnInk}>Get your ticket</Link></Frame>;
  if (!staff) return (
    <Frame title="Organisers only.">
      <div className={`${glass} max-w-[560px] space-y-4 p-8`}>
        {store?.elevate ? (<>
          <p className="text-mute">Demo mode: enter the organiser code (<code className="break-all">NEXT_PUBLIC_EPOCH_ORGANISER_CODE</code>).</p>
          <div className="flex flex-wrap gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="organiser code" className={`${field} !py-3`} /><button className={btnInk} onClick={async () => { const r = await store.elevate!(code); if (r.ok) await refresh(); else setErr(r.error); }}>Unlock</button></div>
          {err && <Notice kind="err">{err}</Notice>}
        </>) : <p className="text-mute">Ask the club lead to set your role to <b className="font-medium text-ink">volunteer</b> or <b className="font-medium text-ink">admin</b> in Supabase.</p>}
      </div>
    </Frame>
  );

  return (
    <Frame title="Organiser desk." sub={`Check people in once they've paid at the desk (${STARTER_COINS} ${EPOCH.currency}, once), fix mistakes, and print the booth QR sheet.`} aside={<div className="no-print flex flex-wrap gap-2"><Link href="/epoch/scan" className={btnInk}>Scan a wallet</Link><Link href="/admin" className={btnSoft}>Club admin ↗</Link><button onClick={() => window.print()} className={btnSoft}>Print QR sheet</button></div>}>
      <MyPost />
      <FindAttendee />
      <Team />
      <AuditLog />
      <h2 className="no-print mb-4 mt-12 text-[28px] font-medium tracking-[-0.03em]">Booth QR codes</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-3">
        {printable.map((b) => (
          <li key={b.id} className={`${glass} flex break-inside-avoid flex-col items-center gap-3 p-6 text-center print:border-black print:bg-white`}>
            <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={qr.booth(b.id)} size={140} level="M" /></div>
            <p className="text-[19px] font-medium leading-tight tracking-[-0.02em]">{b.name}</p>
            <p className={`${label} flex items-center gap-1.5`}><Coin size={14} />{b.kind === "recharge" ? `+${b.coins} once` : `−${b.coins} / session`}</p>
            <p className="text-[10px] text-mute">{qr.booth(b.id)}</p>
            <Link href={`/epoch/kiosk/${b.id}`} className="no-print text-[13px] text-mute underline underline-offset-2 hover:text-ink">Open as a kiosk<span className="sr-only"> for {b.name}</span></Link>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
