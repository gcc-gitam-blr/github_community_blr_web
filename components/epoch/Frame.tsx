import { mono } from "./Bits";

/** Standard page frame for Epoch app screens: hairline grid, mono kicker, big title. */
export function Frame({ kicker, title, aside, children }: { kicker: string; title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-[calc(100vh-70px)] max-w-[1600px] border-x border-epoch-line/70">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-epoch-line/70 p-6 sm:p-8">
        <div><p className={`${mono} mb-3 text-epoch-line`}>{kicker}</p><h1 className="text-[clamp(40px,7vw,96px)]">{title}</h1></div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "ok" | "err" | "info"; children: React.ReactNode }) {
  const c = kind === "ok" ? "bg-epoch text-ink" : kind === "err" ? "bg-red-100 text-red-800" : "bg-soft text-ink-2";
  return <p role="status" className={`rounded-md px-4 py-3 font-mono text-[13px] ${c}`}>{children}</p>;
}
