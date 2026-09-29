"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnGhost, btnGold, card, field, mono } from "./Bits";
import { BoothExplorer } from "./home/BoothExplorer";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { BOOTHS, EPOCH, STARTER_COINS } from "@/lib/epoch/config";
import type { Reward } from "@/lib/epoch/types";

export function BoothsPage() {
  return (
    <Frame kicker="// booths" title={<>Where the <span className="text-gold">coins</span> go.</>}>
      <BoothExplorer />
    </Frame>
  );
}

export function ShopPage() {
  const { store, me, refresh } = useEpoch(); const [items, setItems] = useState<Reward[]>([]);
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null); const [busy, setBusy] = useState("");
  const load = () => store?.rewards().then(setItems);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [store]);

  const buy = async (r: Reward) => {
    if (!store) return; setBusy(r.id); setMsg(null);
    const res = await store.redeem(r.id); setBusy("");
    if (res.ok) { setMsg({ k: "ok", t: `Bought ${r.name}! Show this screen at the Merchandise Stall.` }); await refresh(); void load(); } else setMsg({ k: "err", t: res.error });
  };

  return (
    <Frame kicker="// merchandise stall" title={<>Wear your <span className="text-gold">commits</span>.</>} aside={me ? <Link href="/epoch/wallet" className="flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 font-bold text-night"><Coin size={20} />{me.coins}</Link> : <Link href="/epoch/register" className={btnGold}>Get ticket →</Link>}>
      {msg && <div className="mb-4"><Notice kind={msg.k}>{msg.t}</Notice></div>}
      <ul className="grid gap-3 md:grid-cols-3">
        {items.map((r) => {
          const afford = !!me && me.coins >= r.cost;
          return (
            <li key={r.id} className="flex min-h-[320px] flex-col rounded-3xl border border-edge bg-gradient-to-br from-gold/15 to-transparent p-7">
              <div className="flex items-center justify-between"><span className={`${mono} text-fog`}>{r.stock} left</span><span className={`${mono} flex items-center gap-1.5 font-bold text-gold`}><Coin size={18} />{r.cost}</span></div>
              <h3 className="mt-auto text-3xl">{r.name}</h3><p className="mb-7 mt-2 text-fog">{r.blurb}</p>
              <button disabled={!me || !afford || r.stock <= 0 || busy === r.id} onClick={() => buy(r)} className={afford ? btnGold : btnGhost}>
                {r.stock <= 0 ? "Sold out" : !me ? "Get a ticket first" : afford ? (busy === r.id ? "Buying…" : "Buy with coins") : `Need ${r.cost - me.coins} more`}
              </button>
            </li>
          );
        })}
      </ul>
    </Frame>
  );
}

export function LeaderboardPage() {
  const { store, me } = useEpoch(); const [rows, setRows] = useState<{ id: string; handle: string; name: string; earned: number }[]>([]);
  useEffect(() => { const l = () => store?.leaderboard(50).then(setRows); l(); const i = setInterval(l, 8000); return () => clearInterval(i); }, [store]);
  const medal = ["bg-gold text-night", "bg-[#d7d9e6] text-night", "bg-[#d99a6c] text-night"];
  return (
    <Frame kicker="// leaderboard" title={<>Top <span className="text-gold">earners</span>.</>}>
      <p className="-mt-4 mb-8 max-w-[55ch] text-fog">Ranked by coins earned at recharge points and prizes — spending never lowers your rank.</p>
      {rows.length === 0 && <p className="text-fog">Nobody has earned coins yet. <Link className="text-gold underline" href="/epoch/register">Be first →</Link></p>}
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id} className={`flex items-center gap-4 rounded-3xl border px-5 py-4 sm:gap-6 sm:px-7 ${me?.id === r.id ? "border-gold/60 bg-gold/10" : "border-edge bg-night-2/70"}`}>
            <span className={`grid h-11 w-11 flex-none place-items-center rounded-full font-mono text-sm font-bold ${medal[i] ?? "bg-white/10 text-fog"}`}>{i + 1}</span>
            <div className="min-w-0 flex-1"><p className="truncate font-display text-2xl font-bold tracking-tight">{r.name}</p><p className="truncate font-mono text-sm text-fog">@{r.handle}</p></div>
            <span className="flex items-center gap-2 font-display text-3xl font-black text-gold"><Coin size={26} />{r.earned}</span>
          </li>
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

  if (!ready) return <Frame kicker="// desk" title="…"><div className="h-64" /></Frame>;
  if (!me) return <Frame kicker="// desk" title="Sign in first."><Link href="/epoch/register" className={btnGold}>Get your ticket →</Link></Frame>;
  if (!staff) return (
    <Frame kicker="// desk" title="Organisers only.">
      <div className={`${card} max-w-[560px] space-y-4 p-8`}>
        {store?.elevate ? (<>
          <p className="text-fog">Demo mode: enter the organiser code (<code className="font-mono text-gold">NEXT_PUBLIC_EPOCH_ORGANISER_CODE</code>).</p>
          <div className="flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="organiser code" className={`${field} !py-3 font-mono`} /><button className={btnGold} onClick={async () => { const r = await store.elevate!(code); if (r.ok) await refresh(); else setErr(r.error); }}>Unlock</button></div>
          {err && <Notice kind="err">{err}</Notice>}
        </>) : <p className="text-fog">Ask the club lead to set your role to <b className="text-white">volunteer</b> or <b className="text-white">admin</b> in Supabase.</p>}
      </div>
    </Frame>
  );

  return (
    <Frame kicker="// organiser desk" title="Run the economy." aside={<div className="no-print flex gap-2"><Link href="/epoch/scan" className={btnGold}>Verify tickets / award →</Link><button onClick={() => window.print()} className={btnGhost}>Print QR sheet</button></div>}>
      <div className="no-print mb-6 grid gap-3 md:grid-cols-3">
        {[["1", "Verify tickets", `At the registration desk, scan an attendee's wallet QR and press “Verify ticket”. They receive ${STARTER_COINS} ${EPOCH.currency} once — a second attempt is refused.`],
          ["2", "Stick booth QRs", "Print the sheet below. Recharge points pay once per attendee; spend booths charge each session (with a 20 s double-scan guard)."],
          ["3", "Award prizes", "Competition winners, refunds and goodwill: scan the wallet and use “Award / deduct”, with a reason for the ledger."]].map(([n, t, d]) => (
          <div key={n} className={`${card} p-6`}><span className={`${mono} text-gold`}>Step {n}</span><h3 className="mb-2 mt-3 text-2xl">{t}</h3><p className="text-sm text-fog">{d}</p></div>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-3 print:gap-4">
        {printable.map((b) => (
          <li key={b.id} className="flex break-inside-avoid flex-col items-center gap-3 rounded-3xl border border-edge bg-night-2/70 p-6 text-center print:border-black print:bg-white">
            <div className="rounded-2xl bg-white p-3"><QRCodeSVG value={qr.booth(b.id)} size={150} level="M" /></div>
            <p className="font-display text-xl font-black leading-tight tracking-tight">{b.name}</p>
            <p className={`${mono} flex items-center gap-1.5 text-gold print:text-black`}><Coin size={14} />{b.kind === "recharge" ? `+${b.coins} once` : `−${b.coins} / session`}</p>
            <p className="font-mono text-[10px] text-fog print:text-black">{qr.booth(b.id)}</p>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
