"use client";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { btnInk } from "../Bits";
import { Coin3D } from "../Coin3D";
import { Launcher } from "../Command";
import { useEpoch } from "../EpochProvider";
import { EPOCH, STARTER_COINS } from "@/lib/epoch/config";
import { useClientValue } from "@/lib/useClientValue";

/* Plain and printed: one headline in solid ink, the command bar, the coin. */
export function Hero() {
  const { me } = useEpoch();
  const url = useClientValue(() => `${window.location.origin}/epoch/register`, "/epoch/register");

  return (
    <section className="relative flex min-h-[min(100svh,960px)] items-center pb-24 pt-28">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-6 md:px-10 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <p style={{ "--d": "0.55s" } as React.CSSProperties} className="hero-fade mb-7 font-mono text-[13px] text-mute">
            GitHub Community Club · {EPOCH.org} · {EPOCH.month}
          </p>
          <h1 style={{ "--d": "0.6s" } as React.CSSProperties}
            className="hero-rise text-[clamp(52px,7.4vw,112px)] font-medium leading-[0.95] tracking-[-0.055em]">
            Two days.<br />One currency.
          </h1>
          <p style={{ "--d": "0.8s" } as React.CSSProperties} className="hero-fade mt-7 max-w-[44ch] text-[clamp(18px,1.7vw,21px)] leading-snug text-mute">
            Epoch is our flagship technical event. Everyone starts with {STARTER_COINS} Epoch Coins — spend them at the booths, win more at recharge points.
          </p>
          <div style={{ "--d": "0.95s" } as React.CSSProperties} className="hero-fade mt-10 max-w-[600px]"><Launcher variant="hero" /></div>
          <div style={{ "--d": "1.1s" } as React.CSSProperties} className="hero-fade mt-9 flex flex-wrap items-center gap-6">
            <Link href={me ? "/epoch/wallet" : "/epoch/register"} className={btnInk}>{me ? "Open my wallet" : "Get your ticket"}</Link>
            <a href="#ticket" className="text-[17px] text-mute underline-offset-4 transition hover:text-ink hover:underline">How the coins work</a>
          </div>
        </div>
        <div className="mx-auto hidden aspect-square w-full max-w-[440px] place-items-center lg:grid" aria-hidden><Coin3D size={440} /></div>
      </div>

      <div className="absolute inset-x-0 bottom-6 mx-auto flex max-w-[1200px] items-end justify-between gap-4 px-6 md:px-10">
        <p className="font-mono text-[12.5px] text-mute">{EPOCH.dates}</p>
        <div className="hidden items-center gap-3 md:flex">
          <p className="text-right font-mono text-[12px] leading-tight text-mute">register on<br />your phone</p>
          <div className="rounded-md bg-white p-1.5 shadow-sm"><QRCodeSVG title="QR code for the Epoch ticket link" value={url} size={52} level="L" /></div>
        </div>
      </div>
    </section>
  );
}
