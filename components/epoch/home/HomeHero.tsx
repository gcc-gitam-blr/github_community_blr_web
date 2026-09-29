"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { NodeIcon } from "@/components/ui/GitGraph";
import { Coin3D, UnixClock, Wordmark, btnGhost, btnGold, mono } from "../Bits";
import { useEpoch } from "../EpochProvider";
import { BOOTH_COUNT, EPOCH, RECHARGE_POINTS, STARTER_COINS } from "@/lib/epoch/config";

const STATS = [
  [String(STARTER_COINS), `${EPOCH.currency} per ₹${EPOCH.ticketPriceINR} ticket`],
  [String(BOOTH_COUNT), "booths & experiences"],
  [String(RECHARGE_POINTS.length), "recharge points, once each"],
  ["2", "days of workshops & contests"],
];

export function HomeHero() {
  const { me } = useEpoch();
  return (
    <section className="epoch-noise relative isolate overflow-hidden bg-[radial-gradient(60%_50%_at_75%_35%,rgba(180,139,230,.28),transparent_70%),radial-gradient(45%_45%_at_15%_85%,rgba(255,201,51,.16),transparent_70%)] pb-16 pt-32 md:pt-40">
      {/* the literal Unix time, ticking — 'epoch' is second zero */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-24 -z-10 select-none overflow-hidden whitespace-nowrap text-center md:top-16">
        <UnixClock className="text-[clamp(72px,17vw,300px)] font-bold text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,.09)]" />
      </div>

      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 md:px-10 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className={`${mono} mb-8 flex flex-wrap items-center gap-3 text-fog`}>
            <span className="rounded-full bg-gold px-3 py-1 font-bold text-night">{EPOCH.month}</span>{EPOCH.org} · GitHub Community Club
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} aria-label="epoch 26">
            <Wordmark className="block bg-gradient-to-b from-white to-gold-soft bg-clip-text pb-2 whitespace-nowrap text-[clamp(84px,13.2vw,200px)] text-transparent" />
            <span className="mt-3 block font-display text-[clamp(28px,5vw,56px)] font-bold tracking-tight text-gold">&apos;{EPOCH.edition} · {EPOCH.tagline}</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-8 max-w-[52ch] text-lg text-fog">
            The club&apos;s flagship technical event, run on its own currency. Your ticket becomes {STARTER_COINS} Epoch Coins — spend them on VR, escape rooms and merch, and top up at recharge points by winning mini-games.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25 }} className="mt-9 flex flex-wrap gap-3">
            <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={btnGold}>{me ? "Open my wallet" : "Get your ticket"} →</Link>
            <a href="#plan" className={btnGhost}>See the plan</a>
          </motion.div>
        </div>

        {/* coin + commit-node orbit */}
        <div className="relative mx-auto grid aspect-square w-full max-w-[520px] place-items-center" aria-hidden>
          <div className="absolute inset-[6%] rounded-full border border-dashed border-white/15" />
          <div className="absolute inset-[22%] rounded-full border border-white/10" />
          <div className="absolute inset-0 animate-[orbit_28s_linear_infinite]">
            {[["diamond", "blue", "0%", "50%"], ["ring", "purple", "50%", "0%"], ["triangle", "mint", "100%", "50%"], ["square", "blue", "50%", "100%"]].map(([s, c, l, t]) => (
              <span key={s} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: l, top: t }}>
                <span className="block animate-[orbit_28s_linear_infinite_reverse]"><NodeIcon shape={s as never} color={c as never} size={46} /></span>
              </span>
            ))}
          </div>
          <div className="animate-[float-y_6s_ease-in-out_infinite] drop-shadow-[0_40px_60px_rgba(255,201,51,.35)]"><Coin3D size={260} /></div>
        </div>
      </div>

      <ul className="mx-auto mt-16 grid w-full max-w-[1280px] grid-cols-2 gap-3 px-5 md:px-10 lg:grid-cols-4">
        {STATS.map(([n, l], i) => (
          <motion.li key={l} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="rounded-3xl border border-edge bg-night-2/70 p-6 backdrop-blur">
            <b className="block font-display text-5xl font-black tracking-tighter text-gold">{n}</b>
            <span className="mt-1 block text-sm text-fog">{l}</span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
