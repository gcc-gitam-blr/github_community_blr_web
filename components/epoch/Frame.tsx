import { mono } from "./Bits";

/** Standard page frame for Epoch app screens (sits below the floating nav). */
export function Frame({ kicker, title, aside, children }: { kicker: string; title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1280px] px-5 pb-16 pt-24 md:px-10 md:pt-36">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
        <div><p className={`${mono} mb-4 text-gold`}>{kicker}</p><h1 className="text-[clamp(40px,7vw,88px)]">{title}</h1></div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "ok" | "err" | "info"; children: React.ReactNode }) {
  const c = kind === "ok" ? "border-gold/40 bg-gold/10 text-gold-soft" : kind === "err" ? "border-red-400/40 bg-red-500/10 text-red-200" : "border-edge bg-white/5 text-fog";
  return <p role="status" className={`rounded-2xl border px-5 py-3.5 text-[15px] ${c}`}>{children}</p>;
}
