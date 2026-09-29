"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { btnInk } from "../Bits";
import { Coin3D } from "../Coin3D";
import { Launcher } from "../Command";
import { useEpoch } from "../EpochProvider";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";

/* Plain and printed: one headline in solid ink, the command bar, the coin. */
export function Hero() {
  const { me } = useEpoch();
  const [url, setUrl] = useState("/epoch/register");
  useEffect(() => setUrl(`${window.location.origin}/epoch/register`), []);

  return (
    <section className="relative flex min-h-[min(100svh,960px)] items-center pb-24 pt-28">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-6 md:px-10 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mb-7 font-mono text-[13px] text-mute">
            GitHub Community Club · {EPOCH.org} · {EPOCH.month}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(52px,7.4vw,112px)] font-medium leading-[0.95] tracking-[-0.055em]">
            Two days.<br />One currency.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-7 max-w-[44ch] text-[clamp(18px,1.7vw,21px)] leading-snug text-mute">
            Epoch is our flagship technical event. Your ₹{EPOCH.ticketPriceINR} ticket becomes {STARTER_COINS} Epoch Coins — spend them at the booths, win more at recharge points.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15 }} className="mt-10 max-w-[600px]"><Launcher variant="hero" /></motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="mt-9 flex flex-wrap items-center gap-6">
            <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={btnInk}>{me ? "Open my wallet" : "Get your ticket"}</Link>
            <a href="#ticket" className="text-[17px] text-mute underline-offset-4 transition hover:text-ink hover:underline">How the coins work</a>
          </motion.div>
        </div>
        <div className="mx-auto hidden aspect-square w-full max-w-[440px] place-items-center lg:grid" aria-hidden><Coin3D size={440} /></div>
      </div>

      <div className="absolute inset-x-0 bottom-6 mx-auto flex max-w-[1200px] items-end justify-between gap-4 px-6 md:px-10">
        <p className="font-mono text-[12.5px] text-mute">{EPOCH.dates}</p>
        <div className="hidden items-center gap-3 md:flex">
          <p className="text-right font-mono text-[12px] leading-tight text-mute">register on<br />your phone</p>
          <div className="rounded-md bg-white p-1.5 shadow-sm"><QRCodeSVG value={url} size={52} level="L" /></div>
        </div>
      </div>
    </section>
  );
}
