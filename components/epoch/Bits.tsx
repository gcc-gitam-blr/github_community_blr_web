"use client";
import { EPOCH } from "@/lib/epoch/config";

/** Flat coin: a gold disc with a git commit-node stamped in it. */
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

/** A real 3D coin: stacked discs give it thickness, and it turns slowly on its Y axis. */
export function Coin3D({ size = 280 }: { size?: number }) {
  const layers = 14, depth = size * 0.07;
  const face = (side: 1 | -1) => (
    <div style={{ transform: `translateZ(${(side * depth) / 2}px) ${side === -1 ? "rotateY(180deg)" : ""}`, backfaceVisibility: "hidden" }}>
      <Coin size={size} />
    </div>
  );
  return (
    <div style={{ width: size, height: size, perspective: size * 4 }} aria-hidden>
      <div className="coin3d relative h-full w-full">
        {Array.from({ length: layers }, (_, i) => (
          <div key={i} style={{ transform: `translateZ(${(i / (layers - 1) - 0.5) * depth}px)`, background: i % 2 ? "#c98a00" : "#e0a100" }} />
        ))}
        {face(1)}{face(-1)}
      </div>
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-epoch font-medium lowercase tracking-[-0.05em] ${className}`}>{EPOCH.name}</span>;
}

/* ---- primitives: quiet, soft, one accent ---- */
export const btnInk = "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-[15px] font-medium text-white transition hover:bg-ink/85 active:scale-[0.98] disabled:opacity-40";
export const btnSoft = "inline-flex items-center justify-center gap-2 rounded-full border border-hair bg-white/60 px-7 py-4 text-[15px] font-medium text-ink backdrop-blur transition hover:bg-white/90 disabled:opacity-40";
export const glass = "rounded-[28px] border border-white/70 bg-white/55 shadow-[0_12px_50px_-24px_rgba(70,45,130,.35)] backdrop-blur-xl";
export const label = "text-[13px] text-mute";
export const field = "w-full rounded-2xl border border-hair bg-white/70 px-5 py-4 text-[17px] text-ink outline-none transition placeholder:text-mute/60 focus:border-ink/40 focus:bg-white";
