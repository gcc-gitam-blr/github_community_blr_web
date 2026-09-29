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

/** Thin diagonal light streaks with dot ends — the quiet texture behind the dashboard reference. */
export function Streaks({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1200 800" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <g stroke="#8b83a8" strokeOpacity=".22" strokeWidth="1" fill="none">
        <path d="M-40 640 C 200 610 300 380 560 300" /><path d="M120 820 L 700 330" /><path d="M700 120 L 1240 -40" /><path d="M820 760 C 980 640 1060 560 1240 470" />
      </g>
      <g fill="#8b83a8" fillOpacity=".4"><circle cx="560" cy="300" r="4" /><circle cx="700" cy="330" r="4" /><circle cx="700" cy="120" r="3" /><circle cx="1240" cy="470" r="4" /></g>
    </svg>
  );
}

/* ---- primitives: quiet, soft, one accent ---- */
export const btnInk = "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-[15px] font-medium text-white transition hover:bg-ink/85 active:scale-[0.98] disabled:opacity-40";
export const btnSoft = "inline-flex items-center justify-center gap-2 rounded-full border border-hair bg-white/60 px-7 py-4 text-[15px] font-medium text-ink backdrop-blur transition hover:bg-white/90 disabled:opacity-40";
export const glass = "rounded-[28px] border border-white/70 bg-white/55 shadow-[0_12px_50px_-24px_rgba(70,45,130,.35)] backdrop-blur-xl";
export const label = "text-[13px] text-mute";
export const field = "w-full rounded-2xl border border-hair bg-white/70 px-5 py-4 text-[17px] text-ink outline-none transition placeholder:text-mute/60 focus:border-ink/40 focus:bg-white";
