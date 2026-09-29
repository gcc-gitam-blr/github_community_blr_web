"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Coin, Wordmark, btnEpoch, btnInk, mono } from "./Bits";
import { useEpoch } from "./EpochProvider";
import { EPOCH, SEED_REWARDS, SEED_STALLS } from "@/lib/epoch/config";

function Countdown() {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { const tick = () => setT(new Date(EPOCH.opensAt).getTime() - Date.now()); tick(); const i = setInterval(tick, 1000); return () => clearInterval(i); }, []);
  if (t === null) return <div className="h-[60px]" />;
  if (t <= 0) return <p className={`${mono} flex items-center gap-2 text-ink`}><span className="h-2.5 w-2.5 animate-pulse-ring rounded-full bg-brand" />Live now</p>;
  const u = [["d", Math.floor(t / 864e5)], ["h", Math.floor(t / 36e5) % 24], ["m", Math.floor(t / 6e4) % 60], ["s", Math.floor(t / 1e3) % 60]];
  return (
    <div className="flex gap-4" aria-label="Countdown to Epoch">
      {u.map(([l, v]) => <div key={l as string}><b className="font-display text-4xl font-black tabular-nums tracking-tighter">{String(v).padStart(2, "0")}</b><span className={`${mono} ml-1 text-ink-3`}>{l}</span></div>)}
    </div>
  );
}

function Ticker() {
  const { store } = useEpoch();
  const [top, setTop] = useState<{ handle: string; earned: number }[]>([]);
  useEffect(() => { store?.leaderboard(5).then(setTop); }, [store]);
  return (
    <div className="flex h-full flex-col justify-between bg-epoch-night p-6 font-mono text-[13px] text-[#d8f5dd] sm:p-8">
      <p className="uppercase tracking-[0.16em] text-epoch">▍ top committers</p>
      <ol className="my-6 space-y-2.5">
        {top.length === 0 && <li className="text-[#6b7a70]">No one on the board yet. Be first.</li>}
        {top.map((r, i) => <li key={r.handle} className="flex justify-between gap-4 border-b border-white/10 pb-2"><span><span className="text-[#6b7a70]">{String(i + 1).padStart(2, "0")}</span> @{r.handle}</span><span className="text-epoch">{r.earned}</span></li>)}
      </ol>
      <Link href="/epoch/leaderboard" className="uppercase tracking-[0.16em] text-epoch hover:underline">Full leaderboard →</Link>
    </div>
  );
}

const STEPS = [
  ["01", "Register", `Sign up in 30 seconds and get ${EPOCH.welcomeCoins} ${EPOCH.currency} on the house.`],
  ["02", "Earn", "Scan the QR at every stall. Quizzes, CTFs, PR clinics — each one pays out coins."],
  ["03", "Spend", "Trade coins for merch, mentor hours and mystery drops. Or buy chai. We don't judge."],
];

export function EpochHome() {
  const { me, ready } = useEpoch();
  const line = "border-epoch-line/70";
  return (
    <div className="mx-auto max-w-[1600px] border-x border-epoch-line/70">
      {/* wordmark */}
      <section className={`overflow-hidden border-b ${line} px-3 pt-8 sm:px-5`}>
        <motion.h1 initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <Wordmark className="block text-[clamp(64px,20.5vw,360px)] text-ink" />
        </motion.h1>
      </section>

      {/* info row */}
      <section className={`grid border-b ${line} md:grid-cols-[minmax(0,.9fr)_minmax(0,1.6fr)_minmax(0,.9fr)]`}>
        <div className={`space-y-1 border-b p-6 text-lg sm:p-8 md:border-b-0 md:border-r ${line}`}><p>{EPOCH.dates}</p><p>{EPOCH.venue}</p><p>Free entry · Epoch Coins</p></div>
        <div className={`flex flex-col justify-between gap-6 border-b p-6 sm:p-8 md:border-b-0 md:border-r ${line}`}>
          <p className="max-w-[46ch] text-lg leading-snug">{EPOCH.tagline} Our annual tech fest, gamified end to end: register, collect {EPOCH.currency}, scan your way across every stall, and trade coins for rewards.</p>
          <Countdown />
        </div>
        <div className="flex items-end bg-epoch p-6 sm:p-8">
          <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={`${btnInk} w-full`}>{ready && me ? "Open my wallet ↗" : `Get ${EPOCH.welcomeCoins} coins ↗`}</Link>
        </div>
      </section>

      {/* visual */}
      <section className={`grid border-b ${line} md:grid-cols-[1.6fr_1fr]`}>
        <div className={`relative grid min-h-[380px] place-items-center overflow-hidden border-b bg-[radial-gradient(circle_at_30%_20%,#ffffff_0,#d9ffe6_35%,#a3f5bd_70%)] md:min-h-[520px] md:border-b-0 md:border-r ${line}`}>
          <motion.div animate={{ y: [0, -14, 0], rotate: [-4, 4, -4] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}><Coin size={260} /></motion.div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span key={i} className="absolute" style={{ left: `${10 + i * 15}%`, top: `${12 + ((i * 37) % 70)}%` }}
              animate={{ y: [0, -22, 0], rotate: [0, 180, 360] }} transition={{ repeat: Infinity, duration: 4 + i, delay: i * 0.4, ease: "easeInOut" }}><Coin size={26 + (i % 3) * 14} /></motion.span>
          ))}
          <p className={`${mono} absolute bottom-5 left-6 text-ink/70`}>1 commit = 1 coin. Roughly.</p>
        </div>
        <Ticker />
      </section>

      {/* how it works */}
      <section className={`grid border-b ${line} md:grid-cols-3`}>
        {STEPS.map(([n, t, d], i) => (
          <motion.div key={n} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.7 }}
            className={`min-h-[260px] border-b p-6 last:border-b-0 sm:p-8 md:border-b-0 md:border-r md:last:border-r-0 ${line}`}>
            <span className={`${mono} text-epoch-line`}>{n}</span>
            <h2 className="mb-3 mt-16 text-[44px]">{t}</h2>
            <p className="max-w-[34ch] text-ink-2">{d}</p>
          </motion.div>
        ))}
      </section>

      {/* stalls */}
      <section className={`border-b ${line}`}>
        <div className={`flex items-end justify-between border-b p-6 sm:p-8 ${line}`}><h2 className="text-[clamp(36px,5vw,64px)]">The stalls</h2><Link href="/epoch/stalls" className={`${mono} hover:underline`}>All stalls →</Link></div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3">
          {SEED_STALLS.map((s) => (
            <li key={s.id} className={`group relative border-b p-6 transition hover:bg-epoch/30 sm:p-8 sm:odd:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0 ${line}`}>
              <div className="mb-10 flex items-center justify-between"><span className={`${mono} text-ink-3`}>{s.zone}</span><span className={`${mono} flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${s.kind === "earn" ? "bg-epoch" : "bg-epoch-pink/80"}`}><Coin size={16} />{s.kind === "earn" ? "+" : "−"}{s.coins}</span></div>
              <h3 className="text-[28px]">{s.name}</h3><p className="mt-2 text-ink-2">{s.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* rewards */}
      <section className={`border-b ${line} bg-epoch-night text-white`}>
        <div className="flex items-end justify-between border-b border-white/15 p-6 sm:p-8"><h2 className="text-[clamp(36px,5vw,64px)] text-white">Spend it well</h2><Link href="/epoch/shop" className={`${mono} text-epoch hover:underline`}>Open the shop →</Link></div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-5">
          {SEED_REWARDS.map((r) => (
            <li key={r.id} className="border-b border-white/15 p-6 last:border-b-0 sm:p-7 lg:border-b-0 lg:border-r lg:last:border-r-0">
              <span className={`${mono} flex items-center gap-1.5 text-epoch`}><Coin size={18} />{r.cost}</span>
              <h3 className="mb-2 mt-12 text-2xl text-white">{r.name}</h3><p className="text-sm text-[#a9b3ad]">{r.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid place-items-center gap-8 bg-epoch px-6 py-24 text-center">
        <h2 className="text-[clamp(42px,8vw,110px)] leading-[.95]">Every commit counts.<br />Every coin too.</h2>
        <Link href={me ? "/epoch/scan" : "/epoch/register"} className={btnEpoch.replace("bg-epoch ", "bg-white ")}>{me ? "Start scanning ↗" : "Register now ↗"}</Link>
      </section>
    </div>
  );
}
