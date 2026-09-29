/** Page frame for Epoch app screens: generous space, one big title. */
export function Frame({ title, sub, aside, children }: { kicker?: string; title: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1120px] px-6 pb-20 pt-28 md:px-10 md:pt-40">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-[clamp(44px,7vw,96px)] font-medium leading-[0.98] tracking-[-0.05em]">{title}</h1>
          {sub && <p className="mt-5 max-w-[52ch] text-[19px] text-mute">{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "ok" | "err" | "info"; children: React.ReactNode }) {
  const c = kind === "ok" ? "border-[#c98a00]/30 bg-gold/15" : kind === "err" ? "border-red-300/60 bg-red-50/80 text-red-800" : "border-hair bg-white/60";
  return <p role="status" className={`rounded-2xl border px-5 py-3.5 text-[15px] backdrop-blur ${c}`}>{children}</p>;
}
