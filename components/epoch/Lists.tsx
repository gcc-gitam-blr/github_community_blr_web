"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Frame, Notice } from "./Frame";
import { Coin, btnEpoch, btnInk, mono } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { qr } from "@/lib/epoch/store";
import { EPOCH } from "@/lib/epoch/config";
import type { Reward, Stall } from "@/lib/epoch/types";

export function StallsPage() {
  const { store } = useEpoch(); const [stalls, setStalls] = useState<Stall[]>([]);
  useEffect(() => { store?.stalls().then(setStalls); }, [store]);
  const groups = [["Earn coins", "earn"], ["Spend coins", "spend"]] as const;
  return (
    <Frame kicker="// stalls" title="Where the coins are.">
      {groups.map(([label, kind]) => (
        <section key={kind}>
          <h2 className={`${mono} border-b border-epoch-line/70 bg-soft p-4 sm:px-8`}>{label}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3">
            {stalls.filter((s) => s.kind === kind).map((s) => (
              <li key={s.id} className="border-b border-epoch-line/70 p-6 transition hover:bg-epoch/30 sm:p-8 lg:border-r">
                <div className="mb-10 flex items-center justify-between"><span className={`${mono} text-ink-3`}>{s.zone}</span><span className={`${mono} flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${kind === "earn" ? "bg-epoch" : "bg-epoch-pink/80"}`}><Coin size={16} />{kind === "earn" ? "+" : "−"}{s.coins}</span></div>
                <h3 className="text-[28px]">{s.name}</h3><p className="mt-2 text-ink-2">{s.blurb}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
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
    if (res.ok) { setMsg({ k: "ok", t: `Redeemed ${r.name}! Show this screen at the rewards desk.` }); await refresh(); void load(); } else setMsg({ k: "err", t: res.error });
  };

  return (
    <Frame kicker="// shop" title="Spend it well." aside={me ? <Link href="/epoch/wallet" className={`${mono} flex items-center gap-2 rounded-full bg-epoch px-4 py-2 font-bold`}><Coin size={20} />{me.coins}</Link> : <Link href="/epoch/register" className={btnEpoch}>Sign up ↗</Link>}>
      {msg && <div className="border-b border-epoch-line/70 p-4 sm:px-8"><Notice kind={msg.k}>{msg.t}</Notice></div>}
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => {
          const afford = !!me && me.coins >= r.cost;
          return (
            <li key={r.id} className="flex flex-col border-b border-epoch-line/70 p-6 sm:p-8 lg:border-r">
              <div className="mb-10 flex items-center justify-between"><span className={`${mono} text-ink-3`}>{r.stock} left</span><span className={`${mono} flex items-center gap-1.5 font-bold`}><Coin size={18} />{r.cost}</span></div>
              <h3 className="text-[30px]">{r.name}</h3><p className="mb-8 mt-2 flex-1 text-ink-2">{r.blurb}</p>
              <button disabled={!me || !afford || r.stock <= 0 || busy === r.id} onClick={() => buy(r)} className={afford ? btnEpoch : btnInk}>
                {r.stock <= 0 ? "Sold out" : !me ? "Sign up to redeem" : afford ? (busy === r.id ? "Redeeming…" : "Redeem ↗") : `Need ${r.cost - me.coins} more`}
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
  const medal = ["bg-epoch", "bg-node-blue", "bg-epoch-pink/70"];
  return (
    <Frame kicker="// leaderboard" title={<>Top <span className="text-epoch-line">committers</span>.</>}>
      {rows.length === 0 && <p className="p-8 text-ink-3">No one has earned coins yet. <Link className="underline" href="/epoch/register">Be the first →</Link></p>}
      <ol>
        {rows.map((r, i) => (
          <li key={r.id} className={`flex items-center gap-4 border-b border-epoch-line/50 px-6 py-5 sm:gap-8 sm:px-10 ${me?.id === r.id ? "bg-epoch/40" : ""}`}>
            <span className={`grid h-11 w-11 flex-none place-items-center rounded-full font-mono text-sm font-bold ${medal[i] ?? "bg-soft"}`}>{i + 1}</span>
            <div className="min-w-0 flex-1"><p className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">{r.name}</p><p className="truncate font-mono text-sm text-ink-3">@{r.handle}</p></div>
            <span className="flex items-center gap-2 font-display text-3xl font-black"><Coin size={26} />{r.earned}</span>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

export function AdminPage() {
  const { store, me, ready, refresh } = useEpoch(); const [stalls, setStalls] = useState<Stall[]>([]);
  const [code, setCode] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { store?.stalls().then(setStalls); }, [store]);
  const staff = !!me && me.role !== "attendee";

  if (!ready) return <Frame kicker="// admin" title="…"><div className="h-64" /></Frame>;
  if (!me) return <Frame kicker="// admin" title="Sign in first."><div className="p-8"><Link href="/epoch/register" className={btnEpoch}>Register ↗</Link></div></Frame>;
  if (!staff) return (
    <Frame kicker="// admin" title="Organisers only.">
      <div className="max-w-[520px] space-y-4 p-6 sm:p-10">
        {store?.elevate ? (<>
          <p className="text-ink-2">Demo mode: enter the organiser code (set via <code className="font-mono">NEXT_PUBLIC_EPOCH_ORGANISER_CODE</code>).</p>
          <div className="flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="organiser code" className="min-w-0 flex-1 rounded-md border-2 border-ink/15 px-4 py-3 font-mono outline-none focus:border-epoch-line" /><button className={btnInk} onClick={async () => { const r = await store.elevate!(code); if (r.ok) await refresh(); else setErr(r.error); }}>Unlock</button></div>
          {err && <Notice kind="err">{err}</Notice>}
        </>) : <p className="text-ink-2">Ask the club lead to set your role to <b>volunteer</b> or <b>admin</b> in Supabase.</p>}
      </div>
    </Frame>
  );

  return (
    <Frame kicker="// admin" title="Organiser desk." aside={<div className="flex gap-2"><Link href="/epoch/scan" className={btnEpoch}>Award coins ↗</Link><button onClick={() => window.print()} className={btnInk}>Print QR sheet</button></div>}>
      <div className="border-b border-epoch-line/70 p-4 sm:px-8"><Notice kind="info">Print this sheet and put one QR on each stall table. Each stall works once per attendee, so duplicate scans can&apos;t farm coins.</Notice></div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
        {stalls.map((s) => (
          <li key={s.id} className="flex break-inside-avoid flex-col items-center gap-4 border-b border-epoch-line/70 p-8 text-center lg:border-r">
            <div className="rounded-2xl border-2 border-ink p-3"><QRCodeSVG value={qr.stall(s.id)} size={180} level="M" /></div>
            <p className="font-display text-2xl font-black tracking-tight">{s.name}</p>
            <p className={`${mono} flex items-center gap-1.5`}><Coin size={16} />{s.kind === "earn" ? "earn" : "pay"} {s.coins} {EPOCH.currency}</p>
            <p className="font-mono text-xs text-ink-3">{qr.stall(s.id)}</p>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
