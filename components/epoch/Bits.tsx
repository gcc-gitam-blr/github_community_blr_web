"use client";
import { useEffect, useState } from "react";
import { EPOCH } from "@/lib/epoch/config";

/** Flat coin for inline use: gold disc with a git commit-node stamped in it. */
export function Coin({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="flex-none">
      <circle cx="24" cy="24" r="23" fill="#c98a00" />
      <circle cx="24" cy="24" r="21" fill="#ffc933" />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke="#c98a00" strokeWidth="1.6" strokeDasharray="2.5 3" />
      <path d="M24 12v24" stroke="#7a4f00" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="6" fill="#ffe28f" stroke="#7a4f00" strokeWidth="3" />
    </svg>
  );
}

/** A real 3D coin: stacked discs give it thickness, and it spins on its Y axis. */
export function Coin3D({ size = 280 }: { size?: number }) {
  const layers = 14, depth = size * 0.07;
  const face = (side: 1 | -1) => (
    <div style={{ transform: `translateZ(${side * depth / 2}px) ${side === -1 ? "rotateY(180deg)" : ""}`, backfaceVisibility: "hidden" }}>
      <Coin size={size} />
    </div>
  );
  return (
    <div style={{ width: size, height: size, perspective: size * 4 }} aria-hidden>
      <div className="coin3d relative h-full w-full">
        {Array.from({ length: layers }, (_, i) => (
          <div key={i} style={{ transform: `translateZ(${(i / (layers - 1) - 0.5) * depth}px)`, background: i % 2 ? "#c98a00" : "#e0a100", boxShadow: "inset 0 0 0 2px rgba(0,0,0,.15)" }} />
        ))}
        {face(1)}{face(-1)}
      </div>
    </div>
  );
}

/** The literal Unix time, ticking. "epoch" is second zero of 1970 — our motif. */
export function UnixClock({ className = "" }: { className?: string }) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { const tick = () => setT(Math.floor(Date.now() / 1000)); tick(); const i = setInterval(tick, 1000); return () => clearInterval(i); }, []);
  return <span className={`font-mono tabular-nums ${className}`} suppressHydrationWarning>{t ?? "0000000000"}</span>;
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-black lowercase leading-[0.8] tracking-[-0.07em] ${className}`}>
      {EPOCH.name}
      {/* terminal cursor — drawn as a block so it never inherits the gradient text fill */}
      <span aria-hidden className="ml-[0.06em] inline-block h-[0.1em] w-[0.42em] animate-blink bg-gold align-baseline [-webkit-text-fill-color:initial]" />
    </span>
  );
}

/* ---- primitives ---- */
export const btnGold = "inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 font-display text-[15px] font-bold text-night shadow-[0_8px_30px_-8px_rgba(255,201,51,.6)] transition hover:-translate-y-0.5 hover:bg-gold-soft active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3.5 font-display text-[15px] font-bold text-white transition hover:border-gold hover:text-gold disabled:opacity-50";
export const card = "rounded-3xl border border-edge bg-night-2/80 backdrop-blur";
export const mono = "font-mono text-xs uppercase tracking-[0.16em]";
export const field = "w-full rounded-2xl border border-edge bg-night-3 px-5 py-4 text-lg text-white outline-none transition placeholder:text-fog/60 focus:border-gold";
