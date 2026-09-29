"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Reveal } from "@/components/ui/Reveal";
import { Coin, Coin3D, btnInk } from "./Bits";
import { BoothIndex } from "./home/BoothIndex";
import { PlanList } from "./home/PlanList";
import { useEpoch } from "./EpochProvider";
import { BOOTH_COUNT, EPOCH, RECHARGE_POINTS, REWARDS, STARTER_COINS } from "@/lib/epoch/config";

const wrap = "mx-auto w-full max-w-[1120px] px-6 md:px-10";
const h2 = "text-[clamp(38px,6vw,76px)] font-medium leading-[1.02] tracking-[-0.045em]";

const IDEAS = [
  ["Your ticket is your wallet", `₹${EPOCH.ticketPriceINR} becomes ${STARTER_COINS} ${EPOCH.currency}. The desk verifies it and the coins appear in your profile.`],
  ["Spend at any booth", "VR, escape rooms, arcades, art, merch. Every experience has a coin price; nobody needs cash."],
  ["Recharge, once", `Beat a mini-game at a recharge point to earn ${RECHARGE_POINTS[0].coins} more. Each point works once per person.`],
];

export function EpochHome() {
  const { me } = useEpoch();
  return (
    <>
      {/* hero: one message, one object */}
      <section className="relative flex min-h-[min(100svh,980px)] items-center overflow-hidden pb-16 pt-28">
        <div className={`${wrap} relative z-10`}>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mb-7 text-[17px] text-mute">{EPOCH.org} · {EPOCH.month}</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 1, ease: [0.22, 1, 0.36, 1] }} className="text-[clamp(60px,11vw,168px)] font-medium leading-[0.95] tracking-[-0.055em]">
            Two days.<br />One currency.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-9 max-w-[42ch] text-[clamp(18px,1.8vw,22px)] leading-snug text-mute">
            Epoch is the GitHub Community Club&apos;s flagship event, played with coins. Your ticket becomes {STARTER_COINS} of them.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25 }} className="mt-10 flex flex-wrap items-center gap-6">
            <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={btnInk}>{me ? "Open my wallet" : "Get your ticket"}</Link>
            <a href="#how" className="text-[17px] text-mute transition hover:text-ink">How it works ↓</a>
          </motion.div>
        </div>
        <div aria-hidden className="pointer-events-none absolute bottom-[3%] right-[3%] hidden animate-[float-y_8s_ease-in-out_infinite] drop-shadow-[0_50px_60px_rgba(150,100,0,.28)] md:block lg:right-[6%]"><Coin3D size={270} /></div>
      </section>

      <section id="how" className="py-[clamp(80px,12vw,170px)]">
        <div className={wrap}>
          <ul className="grid gap-12 md:grid-cols-3 md:gap-10">
            {IDEAS.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 0.08} className="border-t border-ink/15 pt-6">
                <span className="text-sm text-mute">0{i + 1}</span>
                <h3 className="mb-3 mt-6 text-[28px] font-medium leading-[1.1] tracking-[-0.035em]">{t}</h3>
                <p className="text-[17px] text-mute">{d}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section id="booths" className="py-[clamp(70px,10vw,140px)]">
        <div className={wrap}>
          <Reveal className="mb-12"><h2 className={h2}>{BOOTH_COUNT} places<br />to spend it.</h2></Reveal>
          <BoothIndex />
        </div>
      </section>

      <section id="plan" className="py-[clamp(70px,10vw,140px)]">
        <div className={wrap}>
          <Reveal className="mb-12"><h2 className={h2}>The plan.</h2></Reveal>
          <PlanList />
        </div>
      </section>

      <section className="py-[clamp(70px,10vw,140px)]">
        <div className={wrap}>
          <Reveal className="mb-10"><h2 className={h2}>Merch, in coins.</h2></Reveal>
          <ul className="grid gap-6 border-t border-hair pt-8 sm:grid-cols-3">
            {REWARDS.map((r) => (
              <li key={r.id}><p className="text-[21px] font-medium tracking-[-0.02em]">{r.name}</p><p className="mt-1 flex items-center gap-2 text-[17px] text-mute"><Coin size={16} />{r.cost}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-[clamp(90px,14vw,200px)]">
        <div className={`${wrap} flex flex-col items-start gap-10`}>
          <Reveal><h2 className="text-[clamp(48px,9vw,132px)] font-medium leading-[0.95] tracking-[-0.055em]">See you at<br />second zero.</h2></Reveal>
          <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={btnInk}>{me ? "Open my wallet" : "Get your ticket"}</Link>
        </div>
      </section>
    </>
  );
}
