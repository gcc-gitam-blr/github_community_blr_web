"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Streaks, btnInk } from "../Bits";
import { Coin3D } from "../Coin3D";
import { Launcher } from "../Command";
import { useEpoch } from "../EpochProvider";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";

/* Hero: Sparked's gradient headline and badge, GitHub's glass command pill,
   Getbell's soft field, diagonal streaks and “what's new” corner note. */
export function Hero() {
  const { me } = useEpoch();
  const [url, setUrl] = useState("/epoch/register");
  useEffect(() => setUrl(`${window.location.origin}/epoch/register`), []);

  return (
    <section className="relative isolate flex min-h-[min(100svh,1000px)] items-center overflow-hidden pb-28 pt-28">
      <Streaks className="-z-10" />
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-6 md:px-10 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <motion.a href="#economy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/60 py-1.5 pl-1.5 pr-5 text-[14px] text-mute shadow-[0_8px_30px_-16px_rgba(70,45,130,.4)] backdrop-blur transition hover:text-ink">
            <span className="rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-white">New</span>Epoch Coins · {EPOCH.month}
          </motion.a>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="bg-gradient-to-br from-ink via-[#4b3f86] to-[#c98a00] bg-clip-text pb-2 text-[clamp(52px,7.4vw,112px)] font-medium leading-[0.95] tracking-[-0.055em] text-transparent">
            Two days.<br />One currency.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-7 max-w-[44ch] text-[clamp(18px,1.7vw,21px)] leading-snug text-mute">
            The GitHub Community Club&apos;s flagship event, played with coins. Your ticket becomes {STARTER_COINS} of them.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.25 }} className="mt-10 max-w-[600px]"><Launcher variant="hero" /></motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="mt-10 flex flex-wrap items-center gap-6">
            <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={btnInk}>{me ? "Open my wallet" : "Get your ticket"}</Link>
            <a href="#economy" className="text-[17px] text-mute transition hover:text-ink">How it works ↓</a>
          </motion.div>
        </div>

        {/* the coin, on a soft golden halo */}
        <div className="relative mx-auto hidden aspect-square w-full max-w-[470px] lg:block" aria-hidden>
          <div className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(255,201,51,.5),rgba(255,201,51,0)_68%)] blur-2xl" />
          <div className="absolute inset-[13%] rounded-full border border-white/60 bg-white/20 shadow-[inset_0_0_60px_rgba(255,255,255,.55)] backdrop-blur-[2px]" />
          <div className="absolute inset-0 grid place-items-center"><Coin3D size={470} /></div>
        </div>
      </div>

      {/* Getbell-style corner note, with a real QR to register */}
      <div className="absolute bottom-7 right-6 hidden items-end gap-4 text-right md:flex md:right-10">
        <div className="text-[14px] leading-snug"><p className="text-ink">What&apos;s new! Epoch Coins are here.</p><Link href="/epoch/booths" className="text-mute underline underline-offset-4 hover:text-ink">See where to spend them →</Link></div>
        <div className="rounded-lg bg-ink p-1.5"><QRCodeSVG value={url} size={50} bgColor="#0b0b0f" fgColor="#ffffff" level="L" /></div>
      </div>
      <p className="absolute bottom-7 left-6 hidden text-[14px] text-mute md:block md:left-10">{EPOCH.org} · {EPOCH.dates}</p>
    </section>
  );
}
