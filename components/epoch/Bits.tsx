"use client";
import { EPOCH } from "@/lib/epoch/config";
import { EpochCoin } from "./EpochCoin";

/** Small inline coin (the proper SVG). */
export function Coin({ size = 24 }: { size?: number }) {
  return <EpochCoin size={size} detail={false} />;
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-epoch font-medium lowercase tracking-[-0.05em] ${className}`}>{EPOCH.name}</span>;
}

/* ---- primitives: quiet, soft, one accent ---- */
export const btnInk = "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-[15px] font-medium text-white transition hover:bg-ink/85 active:scale-[0.98] disabled:opacity-40";
export const btnSoft = "inline-flex items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-7 py-4 text-[15px] font-medium text-ink transition hover:border-ink/40 disabled:opacity-40";
export const glass = "rounded-[22px] border border-ink/10 bg-white shadow-[0_1px_0_rgba(11,11,15,.04),0_14px_30px_-22px_rgba(11,11,15,.35)]"; // paper card
export const label = "text-[13px] text-mute";
export const field = "w-full rounded-2xl border border-hair bg-white/70 px-5 py-4 text-[17px] text-ink outline-none transition placeholder:text-mute/60 focus:border-ink/40 focus:bg-white";
