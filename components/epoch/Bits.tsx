import { EPOCH } from "@/lib/epoch/config";

/** Epoch Coin — an original mark: a green coin with a commit-node in the middle. */
export function Coin({ size = 40, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className={spin ? "animate-[spin_9s_linear_infinite]" : ""}>
      <circle cx="24" cy="24" r="22" fill="#66f28a" stroke="#0b0b0f" strokeWidth="3" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="#0b0b0f" strokeWidth="2" strokeDasharray="3 4" />
      <path d="M24 12v24" stroke="#0b0b0f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="6" fill="#fff" stroke="#0b0b0f" strokeWidth="3" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-display font-black leading-none tracking-[-0.06em] ${className}`}>{EPOCH.name}<span className="text-epoch-line">&apos;{EPOCH.edition}</span></span>;
}

/** Hairline-bordered cell, the building block of the Universe-style grid. */
export function Cell({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`border-epoch-line/70 ${className}`}>{children}</div>;
}

export const btnEpoch = "inline-flex items-center justify-center gap-2 rounded-[6px] border-b-4 border-epoch-line bg-epoch px-5 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-ink transition hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0.5 active:border-b-2 disabled:opacity-50";
export const btnInk = "inline-flex items-center justify-center gap-2 rounded-[6px] bg-ink px-5 py-3 font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-epoch transition hover:-translate-y-0.5 disabled:opacity-50";
export const mono = "font-mono text-[13px] uppercase tracking-[0.14em]";
